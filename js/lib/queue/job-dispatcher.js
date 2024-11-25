const crypto = require("crypto");
const {snakeCase} = require('case-anything');

class JobDispatcher {
    constructor(redisClient) {
        this.redisClient = redisClient; // This client should not be used for pub/sub
        this.subscriptions = new Map();
    }

    static generateJobId() {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(12, (err, buf) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(buf.toString("hex"));
                }
            });
        });
    }

    getQueueKey(queue) {
        if (!queue) return "queue:default";
        return `queue:${snakeCase(queue)}`;
    }

    async enqueue(workerClass, data) {
        if (!this.redisClient.isReady) {
            throw new Error("Redis client is not connected or ready.");
        }

        const jid = await JobDispatcher.generateJobId();

        const queue = this.getQueueKey(data.queue || 'default');
        const payload = {
            "class": workerClass,
            jid,
            queue,
            args: [data],
            at: data.at,
            expires_in: 300
        };

        if (payload.at) {
            await this.redisClient.zAdd("schedule", payload.at, JSON.stringify(payload));
        } else {
            await this.redisClient.lPush(payload.queue, JSON.stringify(payload));
            await this.redisClient.sAdd("queues", payload.queue);
        }
    }

    async listen(jobName, callback) {
        if (!this.redisClient.isReady) {
            throw new Error("Redis client is not connected or ready.");
        }

        const queueKey = this.getQueueKey(jobName);
        this.log(` > ${jobName} Starting to listen on ${queueKey}`);

        const processNextMessage = async () => {
            try {
                const result = await this.redisClient.brPop(queueKey, 5);
                if (result) {
                    const {element} = result;
                    const message = JSON.parse(element);
                    if (message.class === jobName) {
                        await callback(message.args[0]);
                    }
                }
            } catch (error) {
                this.log(`Error processing ${jobName} message: ${error}`);
            }
            // Schedule next check
            setImmediate(processNextMessage);
        };

        // Start the message processing loop
        processNextMessage().then();
    }

    async unsubscribe(jobName) {
        if (!this.redisClient.isReady) {
            throw new Error("Redis client is not connected or ready.");
        }
        const queueKey = this.getQueueKey(jobName);
        const messageHandler = this.subscriptions.get(jobName);
        if (messageHandler) {
            this.redisClient.removeListener('message', messageHandler);
            await this.redisClient.unsubscribe(queueKey);
            this.subscriptions.delete(jobName);
            this.log(`Unsubscribed from ${jobName} jobs on ${queueKey}`);
        } else {
            this.log(`No active subscription found for ${jobName}`);
        }
    }

    log(message) {
        console.log(`${new Date().toISOString()} ${message}`);
    }
}

module.exports = JobDispatcher;