const crypto = require("crypto");

class JobDispatcher {
  constructor(redisClient) {
    this.redisClient = redisClient;
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
    if(!queue) return "queue:default";

    if(!queue.startsWith("queue:")) {
      return `queue:${queue}`;
    }

    return queue;
  }

  async enqueue(workerClass, data) {
    // Check if the client is connected and ready
    if (!this.redisClient.isReady) {
      throw new Error("Redis client is not connected or ready.");
    }

    const jid = await JobDispatcher.generateJobId();

    // Ensure the payload matches the expected structure
    const queue = this.getQueueKey(data.queue || 'default')
    const payload = {
      "class": workerClass,
      jid,
      queue,
      args: [data],
      at: data.at
    };
    // console.log("payload:",payload);

    if (payload.at) {
      // If there's a scheduled time (delayed job), add it to the "schedule" sorted set
      const zadd = async () => {
        await this.redisClient.zAdd(
            "schedule",
            payload.at,
            JSON.stringify(payload)
        );
      };
      await zadd();
    } else {
      // Add the job to the queue list
      const lpush = async () => {
        await this.redisClient.lPush(
            payload.queue,
            JSON.stringify(payload)
        );
      };
      // Register the queue name in the "queues" set
      const sadd = async () => {
        await this.redisClient.sAdd(
            "queues",
            payload.queue
        );
      };
      await Promise.all([lpush(), sadd()]);
    }
  }
}

module.exports = JobDispatcher;