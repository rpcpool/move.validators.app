const BaseDaemon = require('./base-daemon');

/**
 * The Transactions service fetches the latest transaction from the Aptos blockchain
 * every 5 seconds and dispatches a job to the TransactionJob worker.
 */
class Transactions extends BaseDaemon {
    // Default polling interval is 30 seconds
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);

        this.seconds = 30;
        this.interval = undefined;
        this.network = aptos.config.network;
        this.cache = {};
    }

    start() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        this.interval = setInterval(() => {
            this.run().then();
        }, this.seconds * 1000);

        // run immediately
        this.run().then();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log('Transactions service stopped');
    }

    async run() {
        this.log('Transactions service run started');

        try {
            // Fetch the latest transaction using the CLI
            const transactions = await this.aptos.getTransactions({
                start: 0,
                limit: 1
            });
            if (transactions.error) {
                this.log(`Error fetching the latest transaction: ${transactions.message}`);
                return;
            }
            const transactionData = await this.process(transactions[0]);
            // Check if the transaction is new (cache check)
            if (!this.cache[transactionData.hash] || JSON.stringify(this.cache[transactionData.hash]) !== JSON.stringify(transactionData)) {
                // await this.jobDispatcher.enqueue('TransactionJob', transactionData); // Dispatch the job to TransactionJob
                this.cache[transactionData.hash] = transactionData; // Update cache
                this.log(`Latest transaction enqueued: ${transactionData.hash}`);
            } else {
                this.log('No new transaction found.');
            }
        } catch (error) {
            this.log("");
            this.log('Error fetching the latest transaction');
            this.log(error);
            this.log("");

        }

        this.log('Transactions service run complete');
    }


    async process(transactionData) {
        const response = await fetch(`https://api.${this.network}.aptoslabs.com/v1/transactions/by_hash/${transactionData.hash}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        const json = await response.json();
        console.log("json:", JSON.stringify(json));
        transactionData.merged = json;
        console.log("");
        console.log("td", JSON.stringify(transactionData));
        return transactionData;
    }

}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !['test', 'development'].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    new Transactions(redisUrl)
} else {
    console.log(new Date(), 'Transactions service detected test/development environment, not starting in systemd bootstrap.');
}

module.exports = Transactions;