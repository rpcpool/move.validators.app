const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const {createClient} = require("redis");
const JobDispatcher = require("../lib/queue/job-dispatcher");

class BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        this.redisClient = redisClient;
        this.blockingClient = redisClient.duplicate(); // for bprop sync calls
        this.jobDispatcher = jobDispatcher;
        this.aptos = aptos;
        this.running = false;
        this.rateLimit = 300; // in ms

        this.pendingRequests = new Map();
        this.responseQueueKey = `response_queue:${this.constructor.name}`;
        this.requestTimeout = 30000; // 30 seconds timeout
        this.popWait = 5; // seconds to wait for timeout
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
                console.log(new Date(), 'Redis Client Error', e);
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
        console.log(new Date(), `${instance.constructor.name} listening for request responses..`);

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
        console.log(new Date(), message);
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
     * Generates a unique request ID
     * @returns {string}
     */
    generateRequestId() {
        return `${this.constructor.name}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Submits a request to the queue
     * @param {string} url
     * @param {Object} options
     * @returns {Promise<{requestId: string, promise: Promise}>}
     */
    async submitRequestToQueue(url, options = {}) {
        const requestId = this.generateRequestId();
        const requestData = {
            id: requestId,
            url,
            options,
            responseQueue: this.responseQueueKey, // Use the consistent queue key
            source: this.constructor.name,        // Add source for debugging
            timestamp: Date.now()
        };

        // Create promise and set up timeout as before
        const responsePromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${requestId}`));
            }, this.requestTimeout);

            this.pendingRequests.set(requestId, {resolve, reject, timeout});
        });

        this.log(` * pushing to request_queue: ${url}`);
        await this.redisClient.lPush('request_queue', JSON.stringify(requestData));

        return {
            requestId,
            promise: responsePromise
        };
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
                        clearTimeout(pending.timeout);
                        this.pendingRequests.delete(response.requestId);

                        if (response.error) {
                            pending.reject(new Error(response.error));
                        } else {
                            pending.resolve(response.data);
                        }
                        this.log(`Completed processing response for: ${response.requestId}`);
                    }
                }
            } catch (error) {
                this.log(`Error processing response: ${error.message}`);
            }

            // Ensure we continue the loop
            setImmediate(processNextResponse);
        };

        // Start the processing loop
        processNextResponse().catch(error => {
            this.log(`Fatal error in response processor: ${error.message}`);
        });

        this.log(`${this.constructor.name} response listener setup complete`);
    }

    /**
     * Places a url on the queue and returns the response once received
     * @param url
     * @returns {JSON}
     */
    async fetchWithQueue(url, rateLimit, debug = false) {
        try {
            const {promise} = await this.submitRequestToQueue(url, {debug});
            const response = await promise;

            if (debug) {
                console.log(" URL:", url);
                console.log(" Response body:", response);
            }

            return response;
        } catch (error) {
            if (debug) {
                console.log(" Error:", error.message);
            }
            throw error;
        }
    }

}

module.exports = BaseDaemon;
