const { test, refute } = require("../../lib/test/lite-test");
const ValidatorPerformance = require("../../daemons/validator-performance");

// Mock dependencies
const mockRedisClient = {
  quit: async () => {}
};

const mockJobDispatcher = {
  enqueue: async () => {}
};

const mockAptos = {
  config: {
    network: 'testnet'
  }
};

// Mock API responses
const mockLastEpochResponse = {
  data: {
    last_completed: {
      vec: [{
        metadata: {
          dealer_epoch: "100",
          dealer_validator_set: [
            { addr: "0x123", voting_power: "100" }
          ]
        }
      }]
    }
  }
};

const mockPerformanceResponse = {
  type: "0x1::stake::ValidatorPerformance",
  data: {
    validators: [{
      successful_proposals: "5",
      failed_proposals: "1"
    }]
  }
};

const mockValidatorSetResponse = {
  type: "0x1::stake::ValidatorSet",
  data: {
    active_validators: [{
      addr: "0x123",
      voting_power: "100"
    }]
  }
};

test("ValidatorPerformance constructor sets correct defaults", async () => {
  const daemon = new ValidatorPerformance(mockRedisClient, mockJobDispatcher, mockAptos);
  assert.strictEqual(daemon.seconds, 900);
  assert.strictEqual(daemon.network, 'testnet');
});

test("fetchLastEpochAndValidators processes data correctly", async () => {
  const daemon = new ValidatorPerformance(mockRedisClient, mockJobDispatcher, mockAptos);
  daemon.fetchWithQueue = async () => mockLastEpochResponse;

  const result = await daemon.fetchLastEpochAndValidators();
  assert.strictEqual(result.lastEpoch, "100");
  assert.strictEqual(result.validators.length, 1);
  assert.strictEqual(result.validators[0].addr, "0x123");
});

test("fetchValidatorPerformance processes data correctly", async () => {
  const daemon = new ValidatorPerformance(mockRedisClient, mockJobDispatcher, mockAptos);
  daemon.fetchWithQueue = async () => [mockPerformanceResponse, mockValidatorSetResponse];

  const result = await daemon.fetchValidatorPerformance();
  assert.strictEqual(result.performance.length, 1);
  assert.strictEqual(result.validators.length, 1);
  assert.strictEqual(result.performance[0].successful_proposals, "5");
  assert.strictEqual(result.validators[0].addr, "0x123");
});

test("run processes and enqueues data correctly", async () => {
  const daemon = new ValidatorPerformance(mockRedisClient, mockJobDispatcher, mockAptos);
  let enqueuedData = null;

  // Mock dependencies and API calls
  daemon.getCurrentEpoch = async () => "101";
  daemon.fetchLastEpochPerformance = async () => ({
    epoch: "100",
    validators: [{ addr: "0x123", voting_power: "100" }],
    performance: [{ successful_proposals: "5", failed_proposals: "1" }]
  });
  daemon.fetchValidatorPerformance = async () => ({
    performance: [{ successful_proposals: "3", failed_proposals: "0" }],
    validators: [{ addr: "0x123", voting_power: "100" }]
  });
  daemon.jobDispatcher.enqueue = async (job, data) => {
    enqueuedData = data;
  };

  await daemon.run();

  assert.strictEqual(enqueuedData.epoch, "101");
  assert.strictEqual(enqueuedData.performances.length, 1);
  assert.strictEqual(enqueuedData.performances[0].validator_address, "0x123");
  assert.strictEqual(enqueuedData.performances[0].successful_proposals, 3);
  assert.strictEqual(enqueuedData.performances[0].total_proposals, 3);
});

test("handles API errors gracefully", async () => {
  const daemon = new ValidatorPerformance(mockRedisClient, mockJobDispatcher, mockAptos);
  daemon.fetchWithQueue = async () => {
    throw new Error("API Error");
  };

  const result = await daemon.fetchLastEpochAndValidators();
  assert.strictEqual(result.lastEpoch, null);
  assert.strictEqual(result.validators.length, 0);
});
