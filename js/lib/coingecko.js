async function fetchPrice(id = "aptos", fetchFn = fetch) {
  try {
    const response = await fetchFn(
      `https://api.coingecko.com/api/v3/coins/${id}`,
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const price = data.market_data.current_price.usd;
    const marketCap = data.market_data.market_cap.usd;
    const volume24h = data.market_data.total_volume.usd;

    return {
      price,
      marketCap,
      volume24h,
    };
  } catch (error) {
    console.error("Error fetching price data:", error);
    throw error;
  }
}

module.exports = fetchPrice;
