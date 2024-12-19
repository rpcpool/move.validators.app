const FileLog = require('../lib/misc/file-log');
const {padClassName} = require('../lib/utils');
const {createClient} = require("redis");

class RequestManager {
    constructor(redisClient) {
        this.redisClient = redisClient;
        this.blockingClient = redisClient.duplicate();

        // Core configuration
        this.running = false;
        this.maxRequestsPerInterval = 4000; // 4000 requests per 5 minutes
        this.intervalMs = 300000; // 5 minutes in milliseconds
        this.requestInterval = 125; // 125ms between requests (8 RPS target)
        this.maxRPS = 8; // Maximum requests per second to stay under Aptos rate limits
        this.rpsWindow = 1000; // 1 second window for RPS calculation

        // Request tracking
        this.activeRequests = new Map(); // For tracking timeouts
        this.requestHistory = new Map(); // For 30-second deduplication
        this.requestTiming = []; // For rate limiting
        this.rpsTimestamps = []; // For RPS tracking

        // Monitoring stats
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            duplicateRequests: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            errorRate: 0,
            rateLimitHits: 0,
            currentRPS: 0,
            lastUpdated: Date.now()
        };

        // Reset stats from Redis if available
        this.loadStats();

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
     * Load stats from Redis if available
     */
    async loadStats() {
        try {
            const monitoringInfo = await this.redisClient.get('request_manager:monitoring');
            if (monitoringInfo) {
                const info = JSON.parse(monitoringInfo);
                if (info.stats) {
                    this.stats = info.stats;
                }
            }
        } catch (error) {
            this.log(`Error loading stats: ${error.message}`);
        }
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
        try {
            // Calculate current RPS
            const now = Date.now();
            this.rpsTimestamps = this.rpsTimestamps.filter(time => now - time < this.rpsWindow);
            this.stats.currentRPS = this.rpsTimestamps.length;

            const monitoringInfo = {
                stats: this.stats,
                lastUpdated: now
            };
            await this.redisClient.set('request_manager:monitoring', JSON.stringify(monitoringInfo));
        } catch (error) {
            // Silently fail monitoring updates
        }
    }

    /**
     * Check if we're within RPS limits
     */
    checkRPSLimit() {
        const now = Date.now();
        this.rpsTimestamps = this.rpsTimestamps.filter(time => now - time < this.rpsWindow);
        return this.rpsTimestamps.length < this.maxRPS;
    }

    /**
     * Submit a new request to be processed
     */
    async submitRequest(url, options = {}) {
        // Check RPS limit first
        if (!this.checkRPSLimit()) {
            this.stats.rateLimitHits++;
            throw new Error(`RPS limit exceeded: ${this.maxRPS} requests per second`);
        }

        // Update request timing array for 5-minute window
        const now = Date.now();
        this.requestTiming = this.requestTiming.filter(time => now - time < this.intervalMs);
        
        // Check 5-minute rate limit
        if (this.requestTiming.length >= this.maxRequestsPerInterval) {
            this.stats.rateLimitHits++;
            throw new Error(`Rate limit exceeded: ${this.maxRequestsPerInterval} requests per ${this.intervalMs/1000} seconds`);
        }
        
        // Add current request timestamp to both tracking arrays
        this.requestTiming.push(now);
        this.rpsTimestamps.push(now);

        const requestId = this.generateRequestId();
        const timestamp = now;
        const caller = options.source || 'unknown';
        const responseQueue = `response_queue:${caller}`;

        // Check for duplicate requests
        const existingRequest = this.findDuplicateRequest(url);
        if (existingRequest) {
            this.stats.duplicateRequests++;
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
        this.activeRequests.set(requestId, request);
        this.requestHistory.set(url, {
            promise: requestPromise,
            timestamp,
            caller
        });

        // Push request to Redis queue for processing
        const requestData = {
            id: requestId,
            url,
            options,
            source: caller,
            responseQueue
        };

        try {
            await this.redisClient.lPush('request_queue', JSON.stringify(requestData));
        } catch (error) {
            this.log(`Redis error queueing request: ${error.message}`);
            throw new Error(`Failed to queue request: ${error.message}`);
        }

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
                
                // Always schedule next check regardless of result
                setImmediate(processNextRequest);
                
                if (!result) {
                    return;
                }

                const {element} = result;
                let requestData;
                try {
                    requestData = JSON.parse(element);
                    this.stats.totalRequests++;
                    if (!requestData || !requestData.url || !requestData.id || !requestData.responseQueue) {
                        throw new Error('Invalid request data format');
                    }
                } catch (error) {
                    this.log(`Failed to parse request data: ${error.message}`);
                    return;
                }

                const url = requestData.url;
                const startTime = Date.now();
                this.log(`[PROCESSING] ${requestData.url} (${requestData.id})`);

                // Add delay between API requests
                await new Promise(resolve => setTimeout(resolve, this.requestInterval));

                // Make request with timeout
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);

                try {
                    const response = await fetch(requestData.url, {
                        ...requestData.options,
                        headers: {
                            'Accept': 'application/json',
                            ...(requestData.options?.headers || {})
                        },
                        signal: controller.signal
                    });

                    clearTimeout(timeout);

                    // Process response
                    let responseData;
                    if (response.ok) {
                        const data = await response.json();
                        responseData = {
                            requestId: requestData.id,
                            status: response.status,
                            data: data
                        };
                        this.stats.successfulRequests++;
                        this.log(`[SUCCESS] ${requestData.url} (${requestData.id})`);
                    } else {
                        responseData = {
                            requestId: requestData.id,
                            error: `HTTP ${response.status}`,
                            status: response.status
                        };
                        this.stats.failedRequests++;
                        this.log(`[ERROR] ${requestData.url} (${requestData.id}) - ${response.status}`);
                    }

                    // Send response
                    await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(responseData));

                } catch (error) {
                    // Handle any errors (timeout, network, etc)
                    const errorResponse = {
                        requestId: requestData.id,
                        error: error.message,
                        status: error.name === 'AbortError' ? 408 : 500
                    };
                    this.stats.failedRequests++;
                    this.log(`[ERROR] ${requestData.url} (${requestData.id}) - ${error.message}`);
                    
                    try {
                        await this.redisClient.lPush(requestData.responseQueue, JSON.stringify(errorResponse));
                    } catch (e) {
                        this.log(`Redis error sending error response: ${e.message}`);
                    }
                } finally {
                    clearTimeout(timeout);
                    this.cleanupRequest(requestData.id);
                }
            } catch (error) {
                this.log(`Error processing request: ${error.message}`);
            }

            if (this.running) {
                setImmediate(processNextRequest);
            }
        };

        // Start the processing loop and exit on fatal error
        processNextRequest().catch(error => {
            this.log(`Fatal error in request processor: ${error.message}`);
            this.stop();
            process.exit(1); // Exit on fatal error to allow systemd to restart
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
                    this.stats.errorRate = this.stats.failedRequests / this.stats.totalRequests;
                    request.reject(error);
            this.cleanupRequest(requestId);
            this.log(`[TIMEOUT] ${request.url} (${requestId})`);
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
            // Don't remove from request history - let it expire naturally
            // this.requestHistory.delete(request.url);
        }
    }

    /**
     * Find a duplicate request if one exists and prune old requests
     */
    findDuplicateRequest(url) {
        const now = Date.now();
        
        // Prune old requests first
        for (const [storedUrl, request] of this.requestHistory.entries()) {
            if (now - request.timestamp >= 30000) {
                this.requestHistory.delete(storedUrl);
            }
        }

        // Check for duplicate
        const existing = this.requestHistory.get(url);
        if (existing && (now - existing.timestamp) < 30000) {
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
        const timestamp = new Date().toISOString();
        // Format message to highlight URLs
        const formattedMessage = message.includes('http') 
            ? message.replace(/(https?:\/\/[^\s)]+)/g, '\x1b[36m$1\x1b[0m') // Cyan color for URLs
            : message;
            
        const logMessage = `${timestamp} ${padClassName('RequestManager')} ${formattedMessage}`;
        console.log(logMessage);
        
        // Publish log to Redis
        this.redisClient.publish('request_manager:logs', logMessage).catch(() => {});
    }

    /**
     * Start the manager
     */
    async start() {
        this.running = true;
        this.log('Request manager started');
        this.startMonitoringUpdates();
        this.run().catch(error => {
            this.log(`Fatal error in request processor: ${error.message}`);
        });
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

    // Because RequestManager does not extend BaseDaemon, we need to create the redit client manually
    const redisClient = createClient({url: redisUrl});
    redisClient.connect().then(() => {
        RequestManager.create(redisClient).then(() => {
            console.log(new Date(), padClassName("RequestManager"), "service start complete.");
        });
    });
} else {
    console.log(new Date(), padClassName("RequestManager"), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = RequestManager;
