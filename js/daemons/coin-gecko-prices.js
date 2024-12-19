const BaseDaemon = require('./base-daemon');
const {padClassName} = require('../lib/utils');

class CoinGeckoPrices extends BaseDaemon {
    constructor(redisClient, jobDispatcher) {
        super(redisClient, jobDispatcher);
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

        const coinId = 'aptos';
        const endpoint = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;

        try {
            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            const marketData = data.market_data;
            const currencies = ['usd', 'eur'];

            for (const currency of currencies) {
                if (!marketData?.current_price?.[currency]) {
                    this.log(`Market data for currency ${currency} is not available`);
                    continue;
                }

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
                    this.log(`New ${currency.toUpperCase()} price data enqueued - Price: ${priceData.price}, Change: ${priceData["24hr_change"]}%`);
                } else {
                    this.log(`No changes detected for ${currency.toUpperCase()} price data`);
                }
            }
        } catch (error) {
            this.log(`Error fetching price data: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
        }

        this.log('CoinGeckoPrices service run complete');
    }
}

if (process.env.NODE_ENV && !['test', 'development'].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName('CoinGeckoPrices'), "service starting using redis url: ", redisUrl);

    CoinGeckoPrices.create(redisUrl).then(() => {
        console.log(new Date(), padClassName('CoinGeckoPrices'), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName('CoinGeckoPrices'), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = CoinGeckoPrices;
