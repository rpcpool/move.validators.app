const fetchPrice = require("../../lib/coingecko");
const { test, refute } = require("../../lib/test/lite-test");
const assert = require("assert");

// Create a mock for the fetch function
const mockFetch = (url) => {
  if (url === "https://api.coingecko.com/api/v3/coins/aptos") {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          market_data: {
            current_price: { usd: 9.15 },
            market_cap: { usd: 10035314608 },
            total_volume: { usd: 116688624 },
          },
        }),
    });
  } else if (url === "https://api.coingecko.com/api/v3/coins/invalid-coin") {
    return Promise.resolve({
      ok: false,
      status: 404,
    });
  } else {
    return Promise.reject(new Error("Invalid URL"));
  }
};

// Test case using assert
test("successful processing of price fetch", async () => {
  const result = await fetchPrice(undefined, mockFetch);

  assert.strictEqual(result.price, 9.15);
  assert.strictEqual(result.marketCap, 10035314608);
  assert.strictEqual(result.volume24h, 116688624);
});
