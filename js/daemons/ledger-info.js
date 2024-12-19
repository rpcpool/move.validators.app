const BaseDaemon = require('./base-daemon');
const {padClassName} = require('../lib/utils');

class LedgerInfo extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.running = false;
        this.seconds = 60; // 1 minute interval
        this.interval = undefined;
    }

    /**
     * Initialize the daemon
     */
    async start() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        
        this.interval = setInterval(() => {
            if (!this.running) this.run().then();
        }, this.seconds * 1000);

        // Run immediately
        this.run().then();

        this.log('LedgerInfo daemon started');
    }

    /**
     * Stop the daemon
     */
    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.running = false;
        this.log('LedgerInfo daemon stopping');
    }

    /**
     * Main run method
     */
    async run() {
        if (this.running) {
            this.log("Previous run still in progress, skipping");
            return;
        }

        this.running = true;
        this.log("LedgerInfo run started");

        try {
            const network = this.aptos.config.network;
            const url = `https://api.${network}.aptoslabs.com/v1/`;
            
            this.log(`Fetching ledger info from ${url}`);
            const data = await this.fetchWithQueue(url);
            await this.processLedgerInfo(data);

        } catch (error) {
            this.log(`Error in LedgerInfo run: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
        } finally {
            this.running = false;
        }
    }

    /**
     * Process ledger info response and enqueue job
     */
    async processLedgerInfo(data) {
        try {
            // Extract key information
            const {
                chain_id,
                epoch,
                ledger_version,
                oldest_ledger_version,
                ledger_timestamp,
                block_height
            } = data;

            // Prepare job data with all required fields
            const jobData = {
                chain_id: chain_id.toString(),
                epoch: epoch.toString(),
                ledger_version: ledger_version.toString(),
                oldest_ledger_version: oldest_ledger_version.toString(),
                ledger_timestamp: ledger_timestamp.toString(),
                block_height: block_height.toString(),
                // Additional required fields
                node_role: 'full_node',  // Default role for API node
                oldest_block_height: '0', // Default since not provided by API
                git_hash: process.env.GIT_HASH || 'unknown', // From env or default
                recorded_at: new Date().toISOString()
            };

            // Enqueue job for processing
            await this.jobDispatcher.enqueue("EpochJob", jobData);
            this.log(`Enqueued epoch job - Epoch: ${epoch}, Block: ${block_height}`);

        } catch (error) {
            this.log(`Error processing ledger info: ${error.message}`);
            throw error;
        }
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName('LedgerInfo'), "service starting using redis url: ", redisUrl);

    LedgerInfo.create(redisUrl).then(() => {
        console.log(new Date(), padClassName('LedgerInfo'), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName('LedgerInfo'), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = LedgerInfo;
