const RequestProcessor = require("../../daemons/request-processor");
const { test, refute } = require("../../lib/test/lite-test");
const assert = require("assert");

// Mock fetch responses
const createMockFetch = (responses) => {
    let callCount = 0;
    return async () => {
        const response = responses[callCount];
        callCount++;
        return {
            status: response.status,
            headers: new Map(Object.entries(response.headers || {})),
            text: async () => JSON.stringify(response.data || {})
        };
    };
};

// Create a mock for the Redis client
const createMockRedisClient = () => {
    // Shared data store between all instances
    const sharedData = {
        data: {},
        lists: {}
    };

    const createClient = () => ({
        isReady: true,
        async connect() {
            return Promise.resolve();
        },
        async brPop(key, timeout) {
            if (!sharedData.lists[key] || sharedData.lists[key].length === 0) return null;
            const element = sharedData.lists[key].pop();
            return { element };
        },
        async lPush(key, value) {
            if (!sharedData.lists[key]) {
                sharedData.lists[key] = [];
            }
            sharedData.lists[key].unshift(value);
            return sharedData.lists[key].length;
        },
        duplicate() {
            // Return a new client instance that shares the same data store
            return createClient();
        },
        getData: () => sharedData
    });

    return createClient();
};

test("RequestProcessor handles 429 responses with retry-after header", async () => {
    const redisClient = createMockRedisClient();
    const mockFetch = createMockFetch([
        { status: 429, headers: { 'retry-after': '1' } },
        { status: 200, data: { success: true } }
    ]);
    global.fetch = mockFetch;

    const processor = new RequestProcessor(redisClient, null, null);
    await processor.blockingClient.connect();
    
    // Queue a test request
    await redisClient.lPush('request_queue', JSON.stringify({
        id: '123',
        url: 'https://test.com/api',
        responseQueue: 'response_queue',
        options: {}
    }));

    // Start processor and wait for processing
    await processor.start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await processor.stop();

    // Check response
    const { lists } = redisClient.getData();
    assert(lists['response_queue'], "Expected response queue to exist");
    assert.strictEqual(lists['response_queue'].length, 1, "Expected one response");
    
    const response = JSON.parse(lists['response_queue'][0]);
    assert.strictEqual(response.status, 200, "Expected successful status after retry");
    assert.deepStrictEqual(response.data, { success: true }, "Expected success data");
});

test("RequestProcessor handles multiple retries with exponential backoff", async () => {
    const redisClient = createMockRedisClient();
    const mockFetch = createMockFetch([
        { status: 429, headers: {} },
        { status: 429, headers: {} },
        { status: 200, data: { success: true } }
    ]);
    global.fetch = mockFetch;

    const processor = new RequestProcessor(redisClient, null, null);
    await processor.blockingClient.connect();
    
    await redisClient.lPush('request_queue', JSON.stringify({
        id: '124',
        url: 'https://test.com/api',
        responseQueue: 'response_queue',
        options: {}
    }));

    await processor.start();
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for retries
    await processor.stop();

    const { lists } = redisClient.getData();
    assert(lists['response_queue'], "Expected response queue to exist");
    const response = JSON.parse(lists['response_queue'][0]);
    assert.strictEqual(response.status, 200, "Expected successful status after multiple retries");
});

test("RequestProcessor handles request errors", async () => {
    const redisClient = createMockRedisClient();
    global.fetch = async () => {
        throw new Error("Network error");
    };

    const processor = new RequestProcessor(redisClient, null, null);
    await processor.blockingClient.connect();
    
    await redisClient.lPush('request_queue', JSON.stringify({
        id: '125',
        url: 'https://test.com/api',
        responseQueue: 'response_queue',
        options: {}
    }));

    await processor.start();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await processor.stop();

    const { lists } = redisClient.getData();
    assert(lists['response_queue'], "Expected response queue to exist");
    const response = JSON.parse(lists['response_queue'][0]);
    assert.strictEqual(response.status, 500, "Expected error status");
    assert(response.error.includes("Network error"), "Expected error message");
});

test("RequestProcessor maintains blocking queue design", async () => {
    const redisClient = createMockRedisClient();
    const mockFetch = createMockFetch([
        { status: 200, data: { first: true } },
        { status: 200, data: { second: true } }
    ]);
    global.fetch = mockFetch;

    const processor = new RequestProcessor(redisClient, null, null);
    await processor.blockingClient.connect();
    
    // Queue multiple requests
    await redisClient.lPush('request_queue', JSON.stringify({
        id: '126',
        url: 'https://test.com/api/1',
        responseQueue: 'response_queue',
        options: {}
    }));
    await redisClient.lPush('request_queue', JSON.stringify({
        id: '127',
        url: 'https://test.com/api/2',
        responseQueue: 'response_queue',
        options: {}
    }));

    await processor.start();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await processor.stop();

    const { lists } = redisClient.getData();
    assert(lists['response_queue'], "Expected response queue to exist");
    assert.strictEqual(lists['response_queue'].length, 2, "Expected two responses");
    
    const responses = lists['response_queue'].map(r => JSON.parse(r));
    assert(responses.some(r => r.data.first), "Expected first request response");
    assert(responses.some(r => r.data.second), "Expected second request response");
});
