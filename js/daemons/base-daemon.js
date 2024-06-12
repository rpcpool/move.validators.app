const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const {createClient} = require("redis");
const JobDispatcher = require("../lib/queue/job-dispatcher");

class BaseDaemon {
    constructor(redisUrlOrClient) {
        this.redisClient = null;
        this.jobDispatcher = null;

        if (typeof redisUrlOrClient === 'string') {
            this.redisUrl = redisUrlOrClient;
        } else {
            this.redisClient = redisUrlOrClient;
            this.jobDispatcher = new JobDispatcher(this.redisClient);
        }

        let network;
        if (process.env.NODE_ENV) {
            switch (process.env.NODE_ENV) {
                case "production":
                    network = Network.MAINNET;
                    break;
                case "test":
                case "development":
                case "staging":
                    network = Network.TESTNET;
                    break;
                default:
                    network = Network.DEVNET;
            }
        }

        const aptosConfig = new AptosConfig({
            network,
        });

        this.aptos = new Aptos(aptosConfig);
    }

    async initialize() {
        if (this.redisUrl && !this.redisClient) {
            this.redisClient = createClient({url: this.redisUrl});

            this.redisClient.on("error", (err) => {
                console.error("Redis client error:", err);
            });
            this.redisClient.on("connect", () => {
                console.log("Redis client connected");
            });
            this.redisClient.on("ready", () => {
                console.log("Redis client ready");
            });

            try {
                await this.redisClient.connect();
                this.jobDispatcher = new JobDispatcher(this.redisClient);
            } catch (err) {
                console.error("Failed to connect to Redis:", err);
                throw err;
            }
        }
    }

    log(message) {
        console.log(new Date(), message);
    }

    /**
     * Helper that will dig through data to find the item with the matching key
     * @param data
     * @param key
     * @returns {*}
     */
    getItem(data, key) {
        return data.find(item => item.type.includes(key));
    }

    /**
     * Recursive helper to find the value associated with a specific key within the nested objects.
     * @param data
     * @param key
     * @returns {*}
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
}

module.exports = BaseDaemon;
