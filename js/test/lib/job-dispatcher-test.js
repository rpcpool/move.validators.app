const JobDispatcher = require("../../lib/queue/job-dispatcher");
const { test, refute } = require("../../lib/test/lite-test");
const assert = require("assert");

// Create a mock for the Redis client
const createMockRedisClient = () => {
  const data = {};

  return {
    isReady: true,
    async zAdd(key, score, value) {
      if (!data[key]) {
        data[key] = [];
      }
      data[key].push({ score, value });
    },
    async lPush(key, value) {
      if (!data[key]) {
        data[key] = [];
      }
      data[key].unshift(value);
    },
    async sAdd(key, value) {
      if (!data[key]) {
        data[key] = new Set();
      }
      data[key].add(value);
    },
    getData: () => data,
  };
};

test("JobDispatcher generateJobId generates unique job IDs", async () => {
  const jobId1 = await JobDispatcher.generateJobId();
  const jobId2 = await JobDispatcher.generateJobId();
  console.log(jobId1, jobId2);
  refute(jobId1, jobId2, "Expected job IDs to be unique");
});

test("JobDispatcher enqueue schedules a job with a future timestamp", async () => {
  const redisClient = createMockRedisClient();
  const jobDispatcher = new JobDispatcher(redisClient);
  const workerClass = "SomeWorker";
  const futureTimestamp = Math.floor(Date.now() / 1000) + 60; // 60 seconds from now
  const queue = jobDispatcher.getQueueKey("default");
  const payload = { queue, at: futureTimestamp };

  await jobDispatcher.enqueue(workerClass, payload);

  const data = redisClient.getData();
  assert(
      Object.keys(data).includes("schedule"),
      "Expected 'schedule' key to be present"
  );
  assert.strictEqual(
      data["schedule"].length,
      1,
      "Expected 'schedule' to have one job"
  );
  const job = JSON.parse(data["schedule"][0].value);
  assert.strictEqual(job.class, workerClass, "Expected job class to match");
  assert.strictEqual(job.args[0].queue, payload.queue, "Expected job queue to match");
  assert.strictEqual(job.args[0].at, payload.at, "Expected job timestamp to match");
});

test("JobDispatcher enqueue adds a job to the correct queue", async () => {
  const redisClient = createMockRedisClient();
  const jobDispatcher = new JobDispatcher(redisClient);
  const workerClass = "SomeWorker";
  const queueName = "high";
  const expectedQueueKey = jobDispatcher.getQueueKey(queueName);
  const payload = { queue: queueName };

  await jobDispatcher.enqueue(workerClass, payload);

  const data = redisClient.getData();

  assert.strictEqual(Object.keys(data).length, 2, "Expected two keys in data");
  assert(Object.keys(data).includes(expectedQueueKey), "Expected queue key to be present");
  assert(Object.keys(data).includes("queues"), "Expected queues key to be present");
  assert.strictEqual(data[expectedQueueKey].length, 1, "Expected one job in queue");
  
  const job = JSON.parse(data[expectedQueueKey][0]);
  assert.strictEqual(job.class, workerClass, "Expected job class to match");
  assert.strictEqual(job.queue, expectedQueueKey, "Expected job queue to match");
  
  assert(data["queues"] instanceof Set, "Expected queues to be a Set");
  assert.strictEqual(data["queues"].size, 1, "Expected one queue in set");
  assert(data["queues"].has(expectedQueueKey), "Expected queue name in set");
});
