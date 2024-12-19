const BaseDaemon = require("./base-daemon");
const {padClassName} = require('../lib/utils');

class EpochHistory extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.running = false;
        this.seconds = 120; // 2 minute interval
        this.interval = undefined;
        this.network = aptos.config.network;
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

        this.log('EpochHistory daemon started');
    }

    /**
     * Stop the daemon
     */
    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.running = false;
        this.log('EpochHistory daemon stopping');
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
        this.log("EpochHistory run started");

        try {
            // Fetch current epoch info from ValidatorSet
            const validatorSetUrl = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::stake::ValidatorSet`;
            const validatorSetResponse = await this.fetchWithQueue(validatorSetUrl);
            
            if (!validatorSetResponse.data) {
                this.log("No validator set data found");
                return;
            }

            // Fetch ledger info
            const ledgerInfoUrl = `https://api.${this.network}.aptoslabs.com/v1/`;
            const ledgerInfoResponse = await this.fetchWithQueue(ledgerInfoUrl);
            
            if (!ledgerInfoResponse.data) {
                this.log("No ledger info found");
                return;
            }

            const ledgerInfo = ledgerInfoResponse.data;
            const validatorSet = validatorSetResponse.data;

            const epochData = {
                epoch: validatorSet.epoch.toString(),
                ledger_version: ledgerInfo.ledger_version.toString(),
                oldest_ledger_version: ledgerInfo.oldest_ledger_version.toString(),
                ledger_timestamp: ledgerInfo.ledger_timestamp.toString(),
                node_role: ledgerInfo.node_role,
                oldest_block_height: ledgerInfo.oldest_block_height.toString(),
                block_height: ledgerInfo.block_height.toString(),
                git_hash: ledgerInfo.git_hash,
                validator_count: validatorSet.active_validators.length.toString()
            };

            this.log(`Processing epoch data for epoch ${epochData.epoch}`);

            try {
                const jid = await this.jobDispatcher.enqueue("EpochJob", epochData);
                this.log(`Successfully enqueued epoch job ${jid}`);
            } catch (error) {
                this.log(`Failed to enqueue epoch job: ${error.message}`);
                if (error.stack) {
                    this.log(`Stack trace: ${error.stack}`);
                }
                throw error;
            }

        } catch (error) {
            this.log(`Error in EpochHistory run: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
        } finally {
            this.running = false;
        }
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName('EpochHistory'), "service starting using redis url: ", redisUrl);

    EpochHistory.create(redisUrl).then(() => {
        console.log(new Date(), padClassName('EpochHistory'), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName('EpochHistory'), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = EpochHistory;
