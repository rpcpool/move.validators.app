const crypto = require("crypto");

class JobDispatcher {
    constructor(redisClient, pubSubClient) {
        this.redisClient = redisClient; // This client should not be used for pub/sub
        this.pubSubClient = pubSubClient; // Use this one for subscriptions
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
        if (!queue.startsWith("queue:")) {
            return `queue:${queue}`;
        }
        return queue;
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
            at: data.at
        };

        if (payload.at) {
            await this.redisClient.zAdd("schedule", payload.at, JSON.stringify(payload));
        } else {
            await this.redisClient.lPush(payload.queue, JSON.stringify(payload));
            await this.redisClient.sAdd("queues", payload.queue);
        }
    }

    async listen(jobName, callback) {
        if (!this.pubSubClient.isReady) {
            throw new Error("PubSub Redis client is not connected or ready.");
        }

        const queueKey = this.getQueueKey(jobName);
        const messageHandler = (channel, message) => {
            if (channel === queueKey) {
                try {
                    const job = JSON.parse(message);
                    if (job.class === jobName) {
                        callback(job.args[0]);
                    }
                } catch (error) {
                    this.log(`Error processing ${jobName} message:`, error);
                }
            }
        };

        this.subscriptions.set(jobName, messageHandler);
        this.pubSubClient.on('message', messageHandler);
        await this.pubSubClient.subscribe(queueKey);
        this.log(`Listening for ${jobName} jobs on ${queueKey}`);
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