const crypto = require("crypto");
const {snakeCase} = require('case-anything');
const {padClassName} = require('../utils');

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
        const baseQueue = queue ? snakeCase(queue) : "default";
        return `queue:${baseQueue}`;
    }

    async enqueue(workerClass, data) {
        try {
            if (!this.redisClient.isReady) {
                throw new Error("Redis client is not connected or ready.");
            }

            const jid = await JobDispatcher.generateJobId();

            const queueName = data.queue || 'default';
            const queue = this.getQueueKey(queueName);
            const payload = {
                class: workerClass,
                jid,
                queue: snakeCase(queueName),
                args: [data],
                expires_in: 300
            };

            // Ensure proper JSON serialization
            const serializedPayload = JSON.stringify(payload);

            // Log job details before enqueueing with padded class name
            this.log(`[${jid}] > Enqueueing ${workerClass} job to ${queue}`);

            if (data.at) {
                await this.redisClient.zAdd("schedule", data.at, serializedPayload);
                this.log(`[${jid}] > Scheduled ${workerClass} job for ${new Date(data.at).toISOString()}`);
            } else {
                // Add extra logging for ValidatorRewardsJob
                if (workerClass === 'ValidatorRewardsJob') {
                    this.log(`[${jid}] > ValidatorRewardsJob data: ${Object.keys(data).length} validators`);
                }

                await this.redisClient.lPush(queue, serializedPayload);
                await this.redisClient.sAdd("queues", snakeCase(queueName));
                this.log(`[${jid}] > Enqueued ${workerClass} job with ${Object.keys(data).length} data keys`);
            }

            return jid;
        } catch (error) {
            console.error("Error in JobDispatcher.enqueue:", error);
            throw error; // Re-throw to allow caller to handle
        }
    }

    async listen(jobName, callback) {
        if (!this.redisClient.isReady) {
            throw new Error("Redis client is not connected or ready.");
        }

        const queueKey = this.getQueueKey(jobName);
        this.log(`> ${jobName} Starting to listen on ${queueKey}`);

        const processNextMessage = async () => {
            try {
                const result = await this.redisClient.brPop(queueKey, 5);
                if (result) {
                    const {element} = result;
                    const message = JSON.parse(element);
                    if (message.class === jobName) {
                        this.log(`[${message.jid}] < Processing ${jobName} job`);
                        await callback(message.args[0]);
                        this.log(`[${message.jid}] < Completed ${jobName} job`);
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
        // Add space after timestamp
        console.log(`${new Date().toISOString()} ${padClassName('JobDispatcher')} ${message}`);
    }
}

module.exports = JobDispatcher;
