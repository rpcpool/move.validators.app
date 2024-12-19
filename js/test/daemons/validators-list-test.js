const ValidatorsList = require("../../daemons/validators-list");
const { test } = require("../../lib/test/lite-test");
const assert = require("assert");
const { isIpAddress, extractDomain } = require("../../lib/utils");

// Helper to create a test instance
async function createTestInstance(options = {}) {
    const defaultOptions = {
        mockValidatorSet: true,
        mockResources: true,
        mockStakePool: true
    };
    const config = { ...defaultOptions, ...options };

    const redisClient = {
        isReady: true,
        connect: async () => {},
        disconnect: async () => {},
        duplicate: () => redisClient,
        sAdd: async () => {}
    };

    const jobDispatcher = {
        enqueuedJobs: [],
        enqueue: async (jobName, data) => {
            jobDispatcher.enqueuedJobs.push({ jobName, data });
        }
    };

    const aptos = {
        config: { network: 'testnet' }
    };

    const instance = new ValidatorsList(redisClient, jobDispatcher, aptos);
    
    // Basic overrides
    instance.start = () => {};
    instance.stop = () => {};
    instance.log = () => {};
    instance.rateLimit = 0;
    instance.retryDelay = 0;

    // Mock validator set and resources methods
    instance.fetchValidatorSet = async () => {
        if (!config.mockValidatorSet) {
            return null;
        }
        return getMockValidatorSet();
    };

    instance.fetchAccountResources = async () => {
        if (!config.mockResources) {
            return null;
        }
        return getMockResources();
    };

    // Mock stake pool details
    if (config.mockStakePool) {
        instance.getStakePoolDetails = () => ({
            Result: [{
                validator_network_addresses: [
                    "/dns/validator.testnet.com/tcp/6180/noise-ik/0x123/handshake/0"
                ]
            }]
        });
    } else {
        instance.getStakePoolDetails = () => ({ error: true, message: "Failed to get stake pool" });
    }

    // Mock DNS lookups
    instance.dnsLookupPromise = async (host) => {
        if (host === 'validator.testnet.com') {
            return { address: '192.168.1.1' };
        }
        throw new Error('DNS lookup failed');
    };

    instance.dnsReversePromise = async (ip) => {
        if (ip === '192.168.1.1') {
            return ['test.domain.com'];
        }
        throw new Error('DNS reverse lookup failed');
    };

    // Mock getEpochTimestamp
    instance.getEpochTimestamp = async () => "2024-01-01T00:00:00Z";

    return instance;
}

function getMockValidatorSet() {
    return [{
        addr: "0x123",
        voting_power: "1000000",
        config: {
            validator_index: "1",
            consensus_pubkey: "0xpubkey",
            fullnode_addresses: "fullnode_addr",
            network_addresses: "network_addr"
        }
    }];
}

function getMockResources() {
    return [
        {
            type: "0x1::stake::StakingConfig",
            data: { staking_address: "0x456" }
        },
        {
            type: "0x1::stake::StakePool",
            data: { active: { value: "2000000" } }
        },
        {
            type: "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>",
            data: { coin: { value: "3000000" } }
        }
    ];
}

test("ValidatorsList successfully processes validator data", async () => {
    const validator = await createTestInstance();
    await validator.run();

    const jobs = validator.jobDispatcher.enqueuedJobs;
    assert.strictEqual(jobs.length, 1, "Expected one job to be enqueued");
    
    const job = jobs[0];
    assert.strictEqual(job.jobName, "ValidatorJob", "Expected ValidatorJob to be enqueued");
    assert.strictEqual(job.data.address, "0x123", "Expected correct validator address");
    assert.strictEqual(job.data.votingPower, "1000000", "Expected correct voting power");
    assert.strictEqual(job.data.merged.data.stake_pool_active_value, "2000000", "Expected correct stake pool value");
    assert.strictEqual(job.data.host, "test.domain.com", "Expected resolved hostname");
});

test("ValidatorsList handles network errors", async () => {
    const validator = await createTestInstance({ mockValidatorSet: false });
    await validator.run();
    assert.strictEqual(validator.jobDispatcher.enqueuedJobs.length, 0, "Should not enqueue jobs on network error");
});

test("ValidatorsList caches and detects changes", async () => {
    const validator = await createTestInstance();
    
    // First run with initial data
    await validator.run();
    assert.strictEqual(validator.jobDispatcher.enqueuedJobs.length, 1, "Expected first run to enqueue job");

    // Second run with same data (should use cache)
    await validator.run();
    assert.strictEqual(validator.jobDispatcher.enqueuedJobs.length, 1, "Expected no new job when data hasn't changed");

    // Third run with different voting power
    validator.fetchValidatorSet = async () => [{
        ...getMockValidatorSet()[0],
        voting_power: "2000000"
    }];

    await validator.run();
    assert.strictEqual(validator.jobDispatcher.enqueuedJobs.length, 2, "Expected new job when data changed");
});

test("ValidatorsList handles DNS failures gracefully", async () => {
    const validator = await createTestInstance();
    validator.dnsLookupPromise = async () => { throw new Error("DNS lookup failed"); };
    validator.dnsReversePromise = async () => { throw new Error("DNS reverse lookup failed"); };

    await validator.run();
    const jobs = validator.jobDispatcher.enqueuedJobs;
    assert.strictEqual(jobs.length, 1, "Expected job to be enqueued despite DNS failures");
    
    const job = jobs[0];
    assert.strictEqual(job.data.host, "Private/Unknown", "Expected fallback host value");
    assert.strictEqual(job.data.name, "Private/Unknown", "Expected fallback name value");
});

test("ValidatorsList handles missing or invalid stake pool details", async () => {
    const validator = await createTestInstance({ mockStakePool: false });
    await validator.run();
    assert.strictEqual(validator.jobDispatcher.enqueuedJobs.length, 0, "Should skip validator with invalid stake pool");
});

test("ValidatorsList handles missing account resources", async () => {
    const validator = await createTestInstance({ mockResources: false });
    await validator.run();
    const jobs = validator.jobDispatcher.enqueuedJobs;
    assert.strictEqual(jobs.length, 1, "Expected job to be enqueued despite missing resources");
    
    const job = jobs[0];
    assert.strictEqual(job.data.merged.data.stake_pool_active_value, "0", "Expected default stake pool value");
    assert.strictEqual(job.data.merged.data.coin_store_value, "0", "Expected default coin store value");
});
