const BaseDaemon = require("./base-daemon");

class LedgerInfo extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.seconds = 30; // Poll every 30 seconds
        this.interval = undefined;
        this.network = aptos.config.network;
        this.lastLedgerVersion = null;
    }

    async fetchLedgerInfo() {
        const url = `https://api.${this.network}.aptoslabs.com/v1/`;
        try {
            const json = await this.fetchWithQueue(url, this.rateLimit);
            // console.log("");
            // this.log(`fetchLedgerInfo: ${JSON.stringify(json)}`);
            // console.log("");

            return {
                chain_id: parseInt(json.chain_id),
                epoch: json.epoch,
                ledger_version: json.ledger_version,
                oldest_ledger_version: json.oldest_ledger_version,
                ledger_timestamp: json.ledger_timestamp,
                node_role: json.node_role,
                oldest_block_height: json.oldest_block_height,
                block_height: json.block_height,
                git_hash: json.git_hash,
                recorded_at: new Date().toISOString()
            };
        } catch (error) {
            this.log(`Error fetching ledger info: ${error.message}`);
            return null;
        }
    }

    async run() {
        this.running = true;
        this.log("LedgerInfo run started");

        try {
            const ledgerInfo = await this.fetchLedgerInfo();

            if (!ledgerInfo) {
                this.log("Failed to fetch ledger info");
                return;
            }

            // Only enqueue if we have new information
            if (ledgerInfo.ledger_version !== this.lastLedgerVersion) {
                await this.jobDispatcher.enqueue("EpochJob", ledgerInfo);
                this.lastLedgerVersion = ledgerInfo.ledger_version;

                this.log(`Enqueued ledger info: Epoch ${ledgerInfo.epoch}, Height ${ledgerInfo.block_height}, Version ${ledgerInfo.ledger_version}`);
            }

        } catch (error) {
            this.log(`Error in LedgerInfo run: ${error.message}`);
        } finally {
            this.running = false;
        }
    }

    start() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        this.interval = setInterval(() => {
            if (!this.running) this.run().then();
        }, this.seconds * 1000);

        // Run immediately
        this.run().then();

        this.log("LedgerInfo started");
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log("LedgerInfo stopped");
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), "LedgerInfo service starting using redis url: ", redisUrl);

    LedgerInfo.create(redisUrl).then(() => {
        console.log(new Date(), "LedgerInfo service start complete.");
    });
} else {
    console.log(new Date(), "LedgerInfo detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = LedgerInfo;