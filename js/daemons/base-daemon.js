const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const {createClient} = require("redis");
const JobDispatcher = require("../lib/queue/job-dispatcher");

class BaseDaemon {
    constructor(redisClient, pubSubClient, jobDispatcher, aptos) {
        this.redisClient = redisClient;
        this.pubSubClient = pubSubClient;
        this.jobDispatcher = jobDispatcher;
        this.aptos = aptos;
    }

    /**
     * Static method to create an instance of BaseDaemon with asynchronous initialization.
     * @param {string | Object} redisUrlOrClient - Redis connection URL or a Redis client instance.
     * @returns {Promise<BaseDaemon>} A promise that resolves to a fully initialized BaseDaemon instance.
     */
    static async create(redisUrlOrClient, ...args) {
        let redisClient = null;
        let pubSubClient = null;
        let jobDispatcher = null;

        // Initialize Redis clients (main and pub/sub clients)
        if (typeof redisUrlOrClient === 'string') {
            redisClient = createClient({url: redisUrlOrClient})
                .on('error', err => console.log('Redis Client Error', err))
                .connect();
        } else {
            redisClient = redisUrlOrClient;
        }

        // Duplicate the existing redis client for pub/sub
        pubSubClient = redisClient.duplicate();
        // Handle Pub/Sub client events
        pubSubClient.on('error', (err) => console.error("PubSub Redis client error:", err));

        await pubSubClient.connect();

        // Initialize JobDispatcher with both Redis clients
        jobDispatcher = new JobDispatcher(redisClient, pubSubClient);

        // Initialize Aptos SDK
        let network = Network.TESTNET;
        if (process.env.NODE_ENV === 'production' || process.env.APTOS_NETWORK === 'mainnet') {
            network = Network.MAINNET;
        }

        const aptosConfig = new AptosConfig({network});
        const aptos = new Aptos(aptosConfig);

        // Instantiate the daemon class (e.g., ValidatorsList, BlockInfo)
        const self = new this(redisClient, pubSubClient, jobDispatcher, aptos, ...args);

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
    async fetchWithDelay(url, rateLimit) {
        await this.sleep(rateLimit);
        const response = await fetch(url);
        return response.json();
    }

}

module.exports = BaseDaemon;
