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
  assert.strictEqual(job.args[0].queue, payload.queue, "Expected job queue.rake to match");
  assert.strictEqual(job.args[0].at, payload.at, "Expected job timestamp to match");
});

test("JobDispatcher enqueue adds a job to the correct queue.rake", async () => {
  const redisClient = createMockRedisClient();
  const jobDispatcher = new JobDispatcher(redisClient);
  const workerClass = "SomeWorker";
  const queue = jobDispatcher.getQueueKey("high");
  const payload = { queue };

  await jobDispatcher.enqueue(workerClass, payload);

  const data = redisClient.getData();

  assert.strictEqual(Object.keys(data).length, 2);
  assert.strictEqual(Object.keys(data)[0], "queue.rake:high");
  assert.strictEqual(Object.keys(data)[1], "queues");
  assert.strictEqual(data["queue.rake:high"].length, 1);
  const job = JSON.parse(data["queue:high"][0]);
  assert.strictEqual(job.class, workerClass);
  assert.strictEqual(job.queue, payload.queue);
  assert.strictEqual(data["queues"].size, 1);
  assert.strictEqual([...data["queues"]][0], "queue.rake:high");
});