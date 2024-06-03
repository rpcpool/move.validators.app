const Sidekiq = require("../../lib/queue/sidekiq");
const { test, refute } = require("../../lib/test/lite-test");
const assert = require("assert");

// Create a mock for the Redis connection
const createMockRedisConnection = () => {
  const data = {};

  return {
    zadd: (key, score, value) => {
      if (!data[key]) {
        data[key] = [];
      }
      data[key].push({ score, value });
      return Promise.resolve();
    },
    lpush: (key, value) => {
      if (!data[key]) {
        data[key] = [];
      }
      data[key].unshift(value);
      return Promise.resolve();
    },
    sadd: (key, value) => {
      if (!data[key]) {
        data[key] = new Set();
      }
      data[key].add(value);
      return Promise.resolve();
    },
    getData: () => data,
  };
};

test("Sidekiq generateJobId generates unique job IDs", async () => {
  const jobId1 = await Sidekiq.generateJobId();
  const jobId2 = await Sidekiq.generateJobId();
  console.log(jobId1, jobId2);
  refute(jobId1, jobId2, "Expected job IDs to be unique");
});

test("Sidekiq getQueueName returns the correct queue name", () => {
  assert.strictEqual(Sidekiq.getQueueName("high"), "high");
  assert.strictEqual(Sidekiq.getQueueName(undefined), "default");
});

test("Sidekiq namespaceKey namespaces a key correctly", () => {
  const redisConnection = createMockRedisConnection();
  const sidekiq = new Sidekiq(redisConnection, "test");
  assert.strictEqual(sidekiq.namespaceKey("key"), "test:key");
});

test("Sidekiq getQueueKey returns the correct queue key", () => {
  const redisConnection = createMockRedisConnection();
  const sidekiq = new Sidekiq(redisConnection, "test");
  assert.strictEqual(sidekiq.getQueueKey("high"), "test:queue:high");
  assert.strictEqual(sidekiq.getQueueKey(undefined), "test:queue:default");
});

test("Sidekiq enqueue schedules a job with a future timestamp", async () => {
  const redisConnection = createMockRedisConnection();
  const sidekiq = new Sidekiq(redisConnection, "test");
  const workerClass = "SomeWorker";
  const args = [1, 2, 3];
  const futureTimestamp = Math.floor(Date.now() / 1000) + 60; // 60 seconds from now
  const payload = { queue: "default", at: futureTimestamp };

  await sidekiq.enqueue(workerClass, args, payload);

  const data = redisConnection.getData();
  assert(
    Object.keys(data).includes("test:schedule"),
    "Expected 'test:schedule' key to be present",
  );
  assert.strictEqual(
    data["test:schedule"].length,
    1,
    "Expected 'test:schedule' to have one job",
  );
  const job = JSON.parse(data["test:schedule"][0].value);
  assert.strictEqual(job.class, workerClass, "Expected job class to match");
  assert.deepStrictEqual(job.args, args, "Expected job arguments to match");
  assert.strictEqual(job.queue, payload.queue, "Expected job queue to match");
  assert.strictEqual(job.at, payload.at, "Expected job timestamp to match");
});

test("Sidekiq enqueue adds a job to the correct queue", async () => {
  const redisConnection = createMockRedisConnection();
  const sidekiq = new Sidekiq(redisConnection, "test");
  const workerClass = "SomeWorker";
  const args = [1, 2, 3];
  const payload = { queue: "high" };

  await sidekiq.enqueue(workerClass, args, payload);

  const data = redisConnection.getData();
  assert.strictEqual(Object.keys(data).length, 2);
  assert.strictEqual(Object.keys(data)[0], "test:queue:high");
  assert.strictEqual(Object.keys(data)[1], "test:queues");
  assert.strictEqual(data["test:queue:high"].length, 1);
  const job = JSON.parse(data["test:queue:high"][0]);
  assert.strictEqual(job.class, workerClass);
  assert.deepStrictEqual(job.args, args);
  assert.strictEqual(job.queue, payload.queue);
  assert.strictEqual(data["test:queues"].size, 1);
  assert.strictEqual([...data["test:queues"]][0], "high");
});
