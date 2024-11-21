const path = require('path');
const BaseDaemon = require('./base-daemon');
const {Aptos, AptosConfig, Network} = require('@aptos-labs/ts-sdk');


class Transactions extends BaseDaemon {
    // Default polling interval is 5 seconds
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.seconds = 5;
        this.interval = undefined;
        this.network = aptos.config.network;
        this.cache = {};
    }

    start() {
        this.initialize().then(() => {
            if (this.interval) {
                clearInterval(this.interval);
            }

            this.interval = setInterval(() => {
                if (!this.running) this.run().then();
            }, this.seconds * 1000);

            // run immediately
            this.run().then();

            this.log('Transactions service started');
        }).catch((err) => {
            console.error('Failed to initialize Transactions service:', err);
        });
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log('Transactions service stopped');
    }

    async run() {
        this.running = true;
        this.log('Transactions service run started');

        try {
            // Fetch the latest transaction from the Aptos blockchain
            const transactions = await this.aptos.getTransactions({
                start: 0,
                limit: 1
            });

            const latestTransaction = transactions[0];

            // Check if the transaction is new (cache check)
            if (!this.cache[latestTransaction.hash] || JSON.stringify(this.cache[latestTransaction.hash]) !== JSON.stringify(latestTransaction)) {
                await this.jobDispatcher.enqueue('TransactionJob', latestTransaction); // Dispatch the job to TransactionJob
                this.cache[latestTransaction.hash] = latestTransaction; // Update cache
                this.log(`Latest transaction enqueued: ${latestTransaction.hash}`);
                console.log(JSON.stringify(latestTransaction, null, 2));
            } else {
                this.log('No new transaction found.');
            }
            this.log('Transactions service run complete');
        } catch (error) {
            this.log('Error fetching the latest transaction');
            this.log(error);
        } finally {
            this.running = false;
        }

    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !['test', 'development'].includes(process.env.NODE_ENV)) {
    // const redisUrl = process.env.REDIS_URL;
    // new Transactions(redisUrl).start();
} else {
    console.log(new Date(), 'EpochHistory service detected test/development environment, not starting in systemd bootstrap.');
}

module.exports = Transactions;
