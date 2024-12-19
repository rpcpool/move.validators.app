const FileLog = require('../lib/misc/file-log');
const {padClassName} = require('../lib/utils');

class RequestManager {
    constructor(redisClient) {
        this.redisClient = redisClient;
        this.blockingClient = redisClient.duplicate();

        // Core configuration
        this.running = false;
        this.maxRequestsPerInterval = 4000; // 4000 requests per 5 minutes
        this.intervalMs = 300000; // 5 minutes in milliseconds
        this.requestInterval = 75; // 75ms between requests

        // Request tracking
        this.requestQueue = [];
        this.activeRequests = new Map();
        this.requestHistory = new Map(); // For deduplication
        this.requestTiming = []; // For rate limiting

        // Monitoring stats
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            duplicateRequests: 0,
            currentQueueSize: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            lastUpdated: Date.now()
        };

        // Initialize logger
        this.logger = new FileLog({
            filename: 'request-manager',
            classNamePadding: padClassName('RequestManager').length
        });
    }

    /**
     * Static method to create an instance with async initialization
     */
    static async create(redisClient) {
        const instance = new RequestManager(redisClient);
        await instance.blockingClient.connect();
        await instance.start();
        return instance;
    }

    /**
     * Start periodic monitoring updates to Redis
     */
    startMonitoringUpdates() {
        setInterval(() => {
            this.updateMonitoringInfo();
        }, 1000); // Update every second
    }

    /**
     * Update monitoring info in Redis
     */
    async updateMonitoringInfo() {
        const monitoringInfo = {
            stats: this.stats,
            activeRequests: Array.from(this.activeRequests.values()).map(req => ({
                url: req.url,
                timestamp: req.timestamp,
                caller: req.caller,
                elapsedMs: Date.now() - req.timestamp
            })),
            queueSize: this.requestQueue.length,
            currentRate: this.requestTiming.length,
            maxRate: this.maxRequestsPerInterval,
            lastUpdated: Date.now()
        };

        try {
            await this.redisClient.set(
                'request_manager:monitoring',
                JSON.stringify(monitoringInfo)
            );
        } catch (error) {
            this.log(`Error updating monitoring info: ${error.message}`);
        }
    }

    /**
     * Submit a new request to be processed
     */
    async submitRequest(url, options = {}) {
        const requestId = this.generateRequestId();
        const timestamp = Date.now();
        const caller = options.source || 'unknown';
        const responseQueue = `response_queue:${caller}`;

        // Check for duplicate requests
        const existingRequest = this.findDuplicateRequest(url);
        if (existingRequest) {
            this.stats.duplicateRequests++;
            this.log(`Duplicate request detected for ${url} from ${caller}`);
            return existingRequest.promise;
        }

        let requestResolve, requestReject;
        const requestPromise = new Promise((resolve, reject) => {
            requestResolve = resolve;
            requestReject = reject;
        });

        // Create request object
        const request = {
            id: requestId,
            url,
            options,
            timestamp,
            caller,
            responseQueue,
            resolve: requestResolve,
            reject: requestReject,
            timeout: setTimeout(() => {
                this.handleTimeout(requestId);
            }, 30000) // 30 second timeout
        };

        // Add to tracking
        this.requestQueue.push(request);
        this.activeRequests.set(requestId, request);
        this.requestHistory.set(url, {
            promise: requestPromise,
            timestamp,
            caller
        });

        this.stats.totalRequests++;
        this.stats.currentQueueSize = this.requestQueue.length;

        // Push request to Redis queue for processing
        const requestData = {
            id: requestId,
            url,
            options,
            source: caller,
            responseQueue
        };

        await this.redisClient.lPush('request_queue', JSON.stringify(requestData));
        this.log(`Request queued: ${url} from ${caller}`);

        return requestPromise;
    }

    /**
     * Main processing loop
     */
    async run() {
        this.log('RequestManager run starting');

        const processNextRequest = async () => {
            try {
                const result = await this.blockingClient.brPop('request_queue', 5);
                if (result) {
                    const {element} = result;
                    const requestData = JSON.parse(element);
                    const url = requestData.url;

                    this.log(`Processing request from ${requestData.source}: ${url}`);

                    const response = await fetch(requestData.url, {
                        ...requestData.options,
                        headers: {
                            'Accept': 'application/json',
                            ...(requestData.options?.headers || {})
                        }
                    });

                    // Handle 429 Too Many Requests - fail fast
                    if (response.status === 429) {
                        const error = new Error('Rate limit exceeded');
                        this.log(`Rate limited on ${url}, dropping request`);

                        const errorResponse = {
                            requestId: requestData.id,
                            error: error.message,
                            status: 429
                        };

                        await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(errorResponse));
                        return;
                    }

                    // Handle non-200 responses
                    if (!response.ok) {
                        const error = new Error(`HTTP ${response.status}`);
                        this.log(`Request failed: ${url} (status ${response.status})`);

                        const errorResponse = {
                            requestId: requestData.id,
                            error: error.message,
                            status: response.status
                        };

                        await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(errorResponse));
                        return;
                    }

                    // Process successful response
                    const responseBody = await response.text();
                    let data;
                    try {
                        data = responseBody ? JSON.parse(responseBody) : null;
                    } catch (error) {
                        this.log(`Failed to parse JSON response: ${error.message}`);
                        const errorResponse = {
                            requestId: requestData.id,
                            error: 'Invalid JSON response',
                            status: response.status
                        };
                        await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(errorResponse));
                        return;
                    }

                    const responseData = {
                        requestId: requestData.id,
                        status: response.status,
                        data: data
                    };

                    await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(responseData));
                    this.log(`Request completed: ${url} (status ${response.status})`);
                }
            } catch (error) {
                this.log(`Error processing request: ${error.message}`);

                // Ensure we send an error response back to the queue
                if (requestData && requestData.responseQueue) {
                    try {
                        const errorResponse = {
                            requestId: requestData.id,
                            status: 500,
                            error: error.message
                        };

                        await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(errorResponse));
                    } catch (e) {
                        this.log(`Failed to push error response to queue: ${e.message}`);
                    }
                }
            }

            if (this.running) {
                setImmediate(processNextRequest);
            }
        };

        // Start the processing loop
        processNextRequest().catch(error => {
            this.log(`Fatal error in request processor: ${error.message}`);
        });
    }

    /**
     * Handle request timeout
     */
    handleTimeout(requestId) {
        const request = this.activeRequests.get(requestId);
        if (request) {
            const error = new Error(`Request timeout after 30000ms`);
            this.stats.failedRequests++;
            request.reject(error);
            this.cleanupRequest(requestId);
            this.log(`Request timeout for ${request.url}`);
        }
    }

    /**
     * Clean up request tracking
     */
    cleanupRequest(requestId) {
        const request = this.activeRequests.get(requestId);
        if (request) {
            clearTimeout(request.timeout);
            this.activeRequests.delete(requestId);
            this.requestHistory.delete(request.url);
        }
    }

    /**
     * Find a duplicate request if one exists
     */
    findDuplicateRequest(url) {
        const existing = this.requestHistory.get(url);
        if (existing && (Date.now() - existing.timestamp) < 30000) {
            return existing;
        }
        return null;
    }

    /**
     * Generate a unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Helper method to log messages
     */
    log(message) {
        console.log(new Date().toISOString(), padClassName('RequestManager'), message);
    }

    /**
     * Start the manager
     */
    async start() {
        this.running = true;
        this.log('Request manager started');
        this.startMonitoringUpdates();
        await this.run();
    }

    /**
     * Stop the manager
     */
    async stop() {
        this.running = false;
        this.log('Request manager stopping');
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName("RequestManager"), "service starting using redis url: ", redisUrl);

    RequestManager.create(redisUrl).then(() => {
        console.log(new Date(), padClassName("RequestManager"), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName("RequestManager"), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = RequestManager;
