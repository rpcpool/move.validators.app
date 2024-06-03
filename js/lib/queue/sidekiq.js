const crypto = require("crypto");

class Sidekiq {
  constructor(redisConnection, namespace) {
    this.redisConnection = redisConnection;
    this.namespace = namespace;
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

  static getQueueName(queueName) {
    return queueName || "default";
  }

  namespaceKey(key) {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  getQueueKey(queueName) {
    return this.namespaceKey(`queue:${Sidekiq.getQueueName(queueName)}`);
  }

  async enqueue(workerClass, args, payload) {
    const jid = await Sidekiq.generateJobId();
    payload["class"] = workerClass;
    payload.args = args;
    payload.jid = jid;

    if (payload.at) {
      const zadd = async () => {
        await this.redisConnection.zadd(
          this.namespaceKey("schedule"),
          payload.at,
          JSON.stringify(payload),
        );
      };
      await zadd();
    } else {
      const lpush = async () => {
        await this.redisConnection.lpush(
          this.getQueueKey(payload.queue),
          JSON.stringify(payload),
        );
      };
      const sadd = async () => {
        await this.redisConnection.sadd(
          this.namespaceKey("queues"),
          Sidekiq.getQueueName(payload.queue),
        );
      };
      await Promise.all([lpush(), sadd()]);
    }
  }
}

module.exports = Sidekiq;
