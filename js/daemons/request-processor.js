const BaseDaemon = require('./base-daemon');
const FileLog = require('../lib/misc/file-log');

class RequestProcessor extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.running = false;
        // Base retry delays for 429s (in ms): 1s, 2s, 5s
        this.retryDelays = [1000, 2000, 5000];
        this.logger = new FileLog({ 
            filename: 'request-processor',
            classNamePadding: this.classNamePadding // Pass padding length from BaseDaemon
        });
        
        // Initialize monitoring data
        this.monitoringData = {
            stats: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                duplicateRequests: 0,
                currentQueueSize: 0,
                averageResponseTime: 0,
                totalResponseTime: 0,
                lastUpdated: Date.now()
            },
            activeRequests: [],
            queueSize: 0,
            currentRate: 0,
            maxRate: 4000, // 4000 requests per 5 minutes
            lastUpdated: Date.now()
        };
    }

    async updateMonitoringInfo() {
        try {
            // Update queue size
            this.monitoringData.queueSize = await this.redisClient.lLen('request_queue');
            this.monitoringData.lastUpdated = Date.now();
            
            // Update Redis
            await this.redisClient.set(
                'request_manager:monitoring',
                JSON.stringify(this.monitoringData)
            );
            
            this.log(`Updated monitoring info - Queue size: ${this.monitoringData.queueSize}, Active requests: ${this.monitoringData.activeRequests.length}`);
        } catch (error) {
            this.log(`Error updating monitoring info: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
        }
    }

    async run() {
        this.log('RequestProcessor run starting');

        const processNextRequest = async () => {
            let url;
            let requestData;
            let startTime;
            
            try {
                const result = await this.blockingClient.brPop('request_queue', 5);
                if (result) {
                    const {element} = result;
                    requestData = JSON.parse(element);
                    url = requestData.url;
                    startTime = Date.now();

                    // Track active request
                    const activeRequest = {
                        url: url,
                        caller: requestData.source || 'unknown',
                        timestamp: startTime,
                        elapsedMs: 0
                    };
                    this.monitoringData.activeRequests.push(activeRequest);
                    await this.updateMonitoringInfo();

                    this.log(`Processing request from ${requestData.source || 'unknown'}: ${url}`);
                    this.monitoringData.stats.totalRequests++;
                    
                    let retryCount = 0;
                    let shouldRetry = true;
                    let responseData;

                    while (shouldRetry && retryCount < this.retryDelays.length) {
                        // Update active request retry count
                        if (retryCount > 0) {
                            activeRequest.elapsedMs = Date.now() - startTime;
                            await this.updateMonitoringInfo();
                        }

                        const response = await fetch(requestData.url, {
                            ...requestData.options,
                            headers: {
                                'Accept': 'application/json',
                                ...(requestData.options?.headers || {})
                            }
                        });

                        // Handle 429 Too Many Requests
                        if (response.status === 429) {
                            const retryAfter = response.headers.get('retry-after');
                            const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : this.retryDelays[retryCount];
                            
                            this.log(`Rate limited on ${url} (retry ${retryCount + 1}/${this.retryDelays.length}, delay ${delayMs}ms)`);
                            
                            // Update rate info
                            this.monitoringData.currentRate = parseInt(response.headers.get('x-ratelimit-remaining') || '0');
                            await this.updateMonitoringInfo();
                            
                            await this.sleep(delayMs);
                            retryCount++;
                            continue;
                        }

                        // For all other responses, process normally
                        const responseBody = await response.text();
                        const data = responseBody ? JSON.parse(responseBody) : null;
                        
                        responseData = {
                            requestId: requestData.id,
                            status: response.status,
                            data: data,
                            body: responseBody,
                            responseQueue: requestData.responseQueue
                        };

                        // Update rate info for successful requests
                        this.monitoringData.currentRate = parseInt(response.headers.get('x-ratelimit-remaining') || '0');
                        await this.updateMonitoringInfo();

                        this.log(`Request completed: ${url} (status ${response.status})`);
                        shouldRetry = false;

                        // Update stats for successful request
                        if (response.status >= 200 && response.status < 300) {
                            this.monitoringData.stats.successfulRequests++;
                        } else {
                            this.monitoringData.stats.failedRequests++;
                        }
                    }

                    // If we exhausted retries, send back the last response
                    if (shouldRetry) {
                        this.log(`Exhausted retries for ${url}`);
                        this.monitoringData.stats.failedRequests++;
                    }

                    // Update response time stats
                    const responseTime = Date.now() - startTime;
                    this.monitoringData.stats.totalResponseTime += responseTime;
                    this.monitoringData.stats.averageResponseTime = 
                        this.monitoringData.stats.totalResponseTime / this.monitoringData.stats.totalRequests;

                    await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(responseData));
                    await this.updateMonitoringInfo();

                    // Remove from active requests
                    this.monitoringData.activeRequests = this.monitoringData.activeRequests.filter(
                        req => req.url !== url
                    );
                    await this.updateMonitoringInfo();
                }
            } catch (error) {
                this.log(`Error processing request for ${url || 'unknown URL'}: ${error.message}`);
                
                if (requestData) {
                    // Update stats for failed request
                    this.monitoringData.stats.failedRequests++;
                    await this.updateMonitoringInfo();

                    // Remove from active requests
                    this.monitoringData.activeRequests = this.monitoringData.activeRequests.filter(
                        req => req.url !== url
                    );
                    await this.updateMonitoringInfo();

                    // Ensure we send an error response back to the queue
                    if (requestData.responseQueue) {
                        try {
                            const errorResponse = {
                                requestId: requestData.id,
                                status: 500,
                                error: error.message,
                                responseQueue: requestData.responseQueue
                            };
                            
                            await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(errorResponse));
                            this.log(`Error response sent for ${url}`);
                        } catch (e) {
                            this.log(`Failed to push error response to queue: ${e.message}`);
                        }
                    }
                }
            }

            if (this.running) {
                setImmediate(processNextRequest);
            }
        };

        // Start the processing loop
        processNextRequest().then();
    }

    /**
     * Start the processor
     */
    async start() {
        this.running = true;
        
        // Start monitoring updates
        setInterval(() => {
            this.updateMonitoringInfo();
        }, 1000);
        
        this.log('Request processor started');
        this.run().then();
    }

    /**
     * Stop the processor
     */
    async stop() {
        this.running = false;
        // Clear active requests on shutdown
        this.monitoringData.activeRequests = [];
        await this.updateMonitoringInfo();
        
        this.log('Request processor stopping');
    }
}

// Helper function for consistent class name padding in static context
function padClassName(name) {
    const prefix = `[${name}] `;
    return prefix.padEnd(19); // '[ValidatorRewards] ' length
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName("RequestProcessor"), "service starting using redis url: ", redisUrl);

    RequestProcessor.create(redisUrl).then(() => {
        console.log(new Date(), padClassName("RequestProcessor"), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName("RequestProcessor"), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = RequestProcessor;
