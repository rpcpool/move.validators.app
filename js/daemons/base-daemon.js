const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const {createClient} = require("redis");
const JobDispatcher = require("../lib/queue/job-dispatcher");

class BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        this.redisClient = redisClient;
        this.jobDispatcher = jobDispatcher;
        this.aptos = aptos;
        this.running = false;
        this.rateLimit = 300;
    }

    /**
     * Static method to create an instance of BaseDaemon with asynchronous initialization.
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

        console.log(aptosConfig);
        console.log(aptos);

        // Instantiate the daemon class (e.g., ValidatorsList, BlockInfo)
        const self = new this(redisClient, jobDispatcher, aptos, ...args);

        // Check if the subclass has a `start` method and call it
        if (typeof self.start === 'function') {
            await self.start();
        }

        return self;
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
     * Fetches an url after sleeeping provided rate limit time
     * @param url
     * @returns {Promise<any>}
     */
    async fetchWithDelay(url, rateLimit, debug = false) {
        await this.sleep(rateLimit);
        const response = await fetch(url);

        if (debug) {
            console.log(" URL:", url);
            console.log(" Status:", response.status);

            let rawBody;
            try {
                rawBody = await response.text();
                if (response.status !== 200) console.log(" Response body:", rawBody);
            } catch (e) {
                console.log(" Error reading response body:", e.message);
                return undefined;
            }

            if (rawBody && response.ok) {
                try {
                    return JSON.parse(rawBody);
                } catch (e) {
                    console.log(" Error parsing JSON:", e.message);
                    return undefined;
                }
            }
            return undefined;
        }

        return response.json();
    }

}

module.exports = BaseDaemon;
