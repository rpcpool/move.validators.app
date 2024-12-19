const LedgerInfo = require("../../daemons/ledger-info");
const { test } = require("../../lib/test/lite-test");
const assert = require("assert");

// Mock data
const validLedgerResponse = {
    chain_id: 2,
    epoch: '19702',
    ledger_version: '6297808749',
    oldest_ledger_version: '0',
    ledger_timestamp: '1732135228936948',
    node_role: 'full_node',
    oldest_block_height: '0',
    block_height: '397930556',
    git_hash: 'a0ec6ba11bfe4cfc5b586edc9e227aba4909e8fe'
};

// Helper to create a test instance
async function createTestInstance() {
    // Create a minimal mock Redis client
    const redisClient = {
        isReady: true,
        connect: async () => {},
        disconnect: async () => {},
        duplicate: () => redisClient,
        sAdd: async () => {}
    };

    // Create instance but skip Redis setup
    const instance = new LedgerInfo(redisClient, null, { config: { network: 'testnet' } });
    instance.start = () => {};
    instance.listenForResponses = () => {};
    return instance;
}

test("LedgerInfo validates correct ledger info format", async () => {
    const ledgerInfo = await createTestInstance();
    assert(ledgerInfo.validateLedgerInfo(validLedgerResponse), 
        "Should validate correct ledger info");
});

test("LedgerInfo rejects invalid ledger info", async () => {
    const ledgerInfo = await createTestInstance();
    const invalidResponse = { ...validLedgerResponse };
    delete invalidResponse.epoch;

    assert(!ledgerInfo.validateLedgerInfo(invalidResponse), 
        "Should reject ledger info missing required fields");
});

test("LedgerInfo handles fetch failures gracefully", async () => {
    const ledgerInfo = await createTestInstance();
    ledgerInfo.fetchWithQueue = async () => {
        throw new Error("API Error");
    };

    const result = await ledgerInfo.fetchLedgerInfo();
    assert.strictEqual(result, null, "Should return null on fetch failure");
});

test("LedgerInfo successfully enqueues job", async () => {
    let enqueuedJob = null;
    const mockJobDispatcher = {
        enqueue: async (jobName, data) => {
            enqueuedJob = { jobName, data };
        }
    };

    const ledgerInfo = await createTestInstance();
    ledgerInfo.jobDispatcher = mockJobDispatcher;
    ledgerInfo.fetchWithQueue = async () => validLedgerResponse;

    await ledgerInfo.run();

    assert(enqueuedJob, "Should have enqueued a job");
    assert.strictEqual(enqueuedJob.jobName, "EpochJob", "Should enqueue correct job type");
    assert.strictEqual(enqueuedJob.data.epoch, validLedgerResponse.epoch, "Should pass correct epoch data");
});

test("LedgerInfo handles run errors gracefully", async () => {
    const ledgerInfo = await createTestInstance();
    ledgerInfo.jobDispatcher = {
        enqueue: async () => {
            throw new Error("Enqueue error");
        }
    };

    ledgerInfo.fetchWithQueue = async () => validLedgerResponse;

    let error;
    try {
        await ledgerInfo.run();
    } catch (e) {
        error = e;
    }

    assert(!error, "Should handle run errors without throwing");
    assert(!ledgerInfo.running, "Should reset running state after error");
});
