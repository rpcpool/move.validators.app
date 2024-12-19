const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const {createClient} = require("redis");
const JobDispatcher = require("../lib/queue/job-dispatcher");
const {padClassName} = require("../lib/utils");

class BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        this.redisClient = redisClient;
        this.blockingClient = redisClient.duplicate(); // for bprop sync calls
        this.jobDispatcher = jobDispatcher;
        this.aptos = aptos;
        this.running = false;

        this.pendingRequests = new Map();
        this.responseQueueKey = `response_queue:${this.constructor.name}`;
        this.popWait = 15; // seconds to wait for timeout
        // Longest class prefix is '[ValidatorPerformance] ' which is 22 characters
        this.classNamePadding = 22;
    }

    /**
     * Static method to create an instance of BaseDaemon with asynchronous initialization.
     * THIS IS THE ONLY WAY TO CREATE NEW SERVICES/DAEMONS SINCE IT MANAGES ALL THE REDIS CONNECTION AND
     * INSTANTIATION CORRECTLY.
     * @param {string | Object} redisUrlOrClient - Redis connection URL or a Redis client instance.
     * @returns {Promise<BaseDaemon>} A promise that resolves to a fully initialized BaseDaemon instance.
     */
    static async create(redisUrlOrClient, ...args) {
        let redisClient = null;
        let jobDispatcher = null;

        // Initialize Redis clients (main and pub/sub clients)
        if (typeof redisUrlOrClient === 'string') {
            try {
                redisClient = createClient({url: redisUrlOrClient});
                await redisClient.connect();
            } catch (e) {
                console.log(new Date(), padClassName('BaseDaemon'), 'Redis Client Error', e);
            }
        } else {
            redisClient = redisUrlOrClient;
        }

        // Initialize JobDispatcher with both Redis clients
        jobDispatcher = new JobDispatcher(redisClient);

        // Initialize Aptos SDK
        let network = Network.TESTNET;
        if (process.env.NODE_ENV === 'production' || process.env.APTOS_NETWORK === 'mainnet') {
            network = Network.MAINNET;
        }

        const aptosConfig = new AptosConfig({network});
        const aptos = new Aptos(aptosConfig);

        // Instantiate the daemon class (e.g., ValidatorsList, BlockInfo)
        const instance = new this(redisClient, jobDispatcher, aptos, ...args);

        // Make sure we connect the blocking client
        await instance.blockingClient.connect();

        // Start listening for responses
        await instance.listenForResponses();
        console.log(new Date(), padClassName(instance.constructor.name), 'listening for request responses..');

        // Check if the subclass has a `start` method and call it
        if (typeof instance.start === 'function') {
            await instance.start();
        }

        return instance;
    }

    /**
     * Helper method to log messages with a timestamp.
     * @param {string} message - The message to log.
     */
    log(message) {
        console.log(`${new Date().toISOString()} ${padClassName(this.constructor.name)} ${message}`);
    }

    /**
     * Helper that will dig through data to find the item with the matching key.
     * @param {Array} data - The data array to search through.
     * @param {string} key - The key to search for in the data array.
     * @returns {*} The item that matches the key, or undefined if not found.
     */
    getItem(data, key) {
        return data.find(item => item.type.includes(key));
    }

    /**
     * Recursive helper to find the value associated with a specific key within nested objects.
     * @param {Object} obj - The object to search within.
     * @param {string} key - The key to search for within the object.
     * @returns {*} The value associated with the key, or undefined if not found.
     */
    getValueByKey(obj, key) {
        for (const [k, v] of Object.entries(obj)) {
            if (k === key) {
                return v;
            } else if (typeof v === 'object') {
                const found = this.getValueByKey(v, key);
                if (found !== undefined) {
                    return found;
                }
            }
        }
    }

    /**
     * Provides a simple sleep function for pausing any kind of execution
     * @param ms
     * @returns {Promise<unknown>}
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Sets up listen to the proper response queue
     */
    async listenForResponses() {
        this.log(`Starting to listen for responses on queue: ${this.responseQueueKey}`);

        const processNextResponse = async () => {
            try {
                const result = await this.blockingClient.brPop(this.responseQueueKey, this.popWait);

                if (result) {
                    const response = JSON.parse(result.element);
                    const pending = this.pendingRequests.get(response.requestId);

                    if (pending) {
                        this.log(`[${response.requestId}] < Processing response`);

                        // Clean up the pending request before processing to prevent memory leaks
                        this.pendingRequests.delete(response.requestId);
                        clearTimeout(pending.timeout);

                        if (response.error) {
                            const error = new Error(response.error);
                            error.status = response.status;
                            this.log(`[${response.requestId}] < Error response: ${response.error} (${response.status})`);
                            pending.reject(error);
                        } else {
                            this.log(`[${response.requestId}] < Success response (${response.status})`);
                            pending.resolve(response.data);
                        }
                    } else {
                        this.log(`Warning: Received response for unknown request ${response.requestId}`);
                    }
                }
            } catch (error) {
                this.log(`Error processing response: ${error.message}`);
            }

            // Ensure we continue the loop with error handling
            if (this.running) {
                setImmediate(() => {
                    processNextResponse().catch(error => {
                        this.log(`Error in response processor: ${error.message}`);
                        // Add delay before retry on error
                        setTimeout(processNextResponse, 1000);
                    });
                });
            }
        };

        // Start the processing loop
        this.running = true;
        processNextResponse().catch(error => {
            this.log(`Fatal error in response processor: ${error.message}`);
            if (this.running) {
                setTimeout(() => processNextResponse(), 1000);
            }
        });
    }

    /**
     * Places a url on the queue and returns the response once received
     * @param url
     * @returns {JSON}
     */
    async fetchWithQueue(url, debug = false) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();

        let requestResolve, requestReject;
        const requestPromise = new Promise((resolve, reject) => {
            requestResolve = resolve;
            requestReject = reject;
        });

        // Create request object for tracking with timeout
        const timeoutMs = 30000; // 30 second timeout
        const timeout = setTimeout(() => {
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
                this.pendingRequests.delete(requestId);
                const error = new Error(`Request timeout after ${timeoutMs}ms`);
                error.status = 408;
                this.log(`[${requestId}] ! Request timeout for ${url}`);
                requestReject(error);
            }
        }, timeoutMs);

        const request = {
            resolve: requestResolve,
            reject: requestReject,
            timeout: timeout,
            startTime: startTime
        };

        // Add to pending requests
        this.pendingRequests.set(requestId, request);

        // Push request to queue
        const requestData = {
            id: requestId,
            url,
            timestamp: startTime,
            source: this.constructor.name,
            options: {
                headers: {
                    'Accept': 'application/json',
                    'Connection': 'keep-alive'
                },
                keepalive: true,
                ...debug ? {debug} : {}
            },
            responseQueue: this.responseQueueKey
        };

        try {
            this.log(`[${requestId}] > Queueing request to ${url}`);
            await this.redisClient.lPush('request_queue', JSON.stringify(requestData));

            const response = await requestPromise;
            const duration = Date.now() - startTime;

            if (debug) {
                this.log(`[${requestId}] < Response received in ${duration}ms: ${JSON.stringify(response)}`);
            } else {
                this.log(`[${requestId}] < Response received in ${duration}ms`);
            }

            return response;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.log(`[${requestId}] ! Error after ${duration}ms: ${error.message}`);

            // Clean up the pending request on error
            this.pendingRequests.delete(requestId);
            clearTimeout(timeout);

            throw error;
        }
    }
}

module.exports = BaseDaemon;
