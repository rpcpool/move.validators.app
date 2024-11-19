const BaseDaemon = require('./base-daemon');

class CoinGeckoPrices extends BaseDaemon {
    constructor(redisClient, pubSubClient, jobDispatcher) {
        super(redisClient, pubSubClient, jobDispatcher);
        this.seconds = 300;
        this.interval = undefined;
        this.cache = {
            usd: {},
            eur: {}
        };
    }

    start() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        this.interval = setInterval(() => {
            this.run().then();
        }, this.seconds * 1000);

        this.run().then();
        this.log('CoinGeckoPrices service started');
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log('CoinGeckoPrices service stopped');
    }

    async run() {
        this.log('CoinGeckoPrices service run started');

        // {"id"=>"aptos", "symbol"=>"apt", "name"=>"Aptos"}

        const coinId = 'aptos'; // You can replace this with the desired coin ID
        const endpoint = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

        try {
            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            const marketData = data.market_data;
            const currencies = ['usd', 'eur']; // Add more currencies if needed

            for (const currency of currencies) {
                // Ensure market data exists before accessing properties
                if (marketData && marketData.current_price && marketData.current_price[currency]) {
                    const priceData = {
                        currency: currency,
                        price: marketData.current_price[currency].toString(),
                        "24hr_change": marketData.price_change_percentage_24h_in_currency[currency]?.toString() || '0',
                        "24hr_volume": marketData.total_volume[currency]?.toString() || '0'
                    };

                    const cacheKey = JSON.stringify(priceData);
                    if (!this.cache[currency].data || this.cache[currency].data !== cacheKey) {
                        await this.jobDispatcher.enqueue('CoingeckoPriceJob', priceData);
                        this.cache[currency].data = cacheKey;
                        this.log(`New ${currency.toUpperCase()} price data enqueued`);
                    }
                } else {
                    this.log(`Market data for currency ${currency} is not available`);
                }
            }
        } catch (error) {
            console.error('Error fetching detailed coin data:', error);
        }

        this.log('CoinGeckoPrices service run complete');
    }
}

if (process.env.NODE_ENV && !['test', 'development'].includes(process.env.NODE_ENV)) {
    // Production startup code here
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), "CoinGeckoPrices service starting using redis url: ", redisUrl);

    new CoinGeckoPrices(redisUrl);
} else {
    console.log(new Date(), 'CoinGeckoPrices service detected test/development environment, not starting in systemd bootstrap.');
}

module.exports = CoinGeckoPrices;