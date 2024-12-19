const BaseDaemon = require("./base-daemon");
const {padClassName} = require('../lib/utils');

const railsJob = "BlockProposalsJob";

class BlockProposals extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.seconds = 60;
        this.interval = undefined;
        this.network = aptos.config.network;
        this.lastProcessedHeight = 0;
        this.blocksToFetch = 50;
    }

    validateLedgerInfo(json) {
        const requiredFields = ['block_height', 'oldest_block_height'];
        return requiredFields.every(field => json.hasOwnProperty(field) && json[field] !== null);
    }

    validateBlock(block) {
        const requiredFields = [
            'block_height',
            'block_hash',
            'block_timestamp',
            'first_version',
            'last_version',
            'transactions'
        ];
        return requiredFields.every(field => block.hasOwnProperty(field) && block[field] !== null);
    }

    async fetchLedgerInfo() {
        const url = `https://api.${this.network}.aptoslabs.com/v1/`;
        try {
            const json = await this.fetchWithQueue(url);
            
            if (!this.validateLedgerInfo(json)) {
                throw new Error('Invalid ledger info format');
            }

            return {
                currentHeight: parseInt(json.block_height),
                oldestHeight: parseInt(json.oldest_block_height)
            };
        } catch (error) {
            this.log(`Error fetching ledger info: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return null;
        }
    }

    async fetchBlock(height) {
        const url = `https://api.${this.network}.aptoslabs.com/v1/blocks/by_height/${height}?with_transactions=true`;
        try {
            const block = await this.fetchWithQueue(url);
            
            if (!this.validateBlock(block)) {
                throw new Error(`Invalid block format for height ${height}`);
            }

            // Find the block_metadata_transaction
            const blockMetadataTransaction = block.transactions?.find(tx => tx.type === 'block_metadata_transaction');
            const epoch = blockMetadataTransaction?.epoch || null;

            // Find the NewBlockEvent in the block's events
            const newBlockEvent = blockMetadataTransaction?.events?.find(event =>
                event.type === '0x1::block::NewBlockEvent'
            );
            const proposer = newBlockEvent?.data?.proposer;

            if (!proposer) {
                this.log(`Warning: Block ${height} missing proposer`);
            }

            if (!epoch) {
                this.log(`Warning: Block ${height} missing epoch`);
            }

            return {
                block_height: block.block_height,
                block_hash: block.block_hash,
                block_timestamp: block.block_timestamp,
                first_version: block.first_version,
                last_version: block.last_version,
                validator_address: proposer,
                epoch: epoch
            };
        } catch (error) {
            this.log(`Error fetching block at height ${height}: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return null;
        }
    }

    async fetchLatestBlocks() {
        const ledgerInfo = await this.fetchLedgerInfo();
        if (!ledgerInfo) return [];

        const currentHeight = ledgerInfo.currentHeight;
        let startHeight = this.lastProcessedHeight || ledgerInfo.oldestHeight;
        startHeight = Math.max(startHeight, currentHeight - this.blocksToFetch);

        const blocks = [];
        const promises = [];
        
        // Generate array of heights to process
        for (let height = startHeight + 1; height <= currentHeight; height++) {
            promises.push(this.fetchBlock(height));
        }

        // Process all blocks in parallel using request-manager's queue
        const results = await Promise.all(promises);
        
        // Filter out any null results from failed fetches
        for (const block of results) {
            if (block) {
                blocks.push(block);
                this.log(`Successfully fetched block at height ${block.block_height}`);
            }
        }

        if (blocks.length > 0) {
            this.lastProcessedHeight = currentHeight;
            this.log(`Processed ${blocks.length} blocks`);
        }

        return blocks;
    }

    async run() {
        if (this.running) {
            this.log("Previous run still in progress, skipping");
            return;
        }

        this.running = true;
        this.log("BlockProposals run started");

        try {
            const blocks = await this.fetchLatestBlocks();
            
            if (blocks.length > 0) {
                await this.jobDispatcher.enqueue(railsJob, { blocks: blocks });
                this.log(`Enqueued ${blocks.length} new block proposals from height ${blocks[0].block_height} to ${blocks[blocks.length - 1].block_height}`);
            } else {
                this.log("No new blocks to process");
            }
        } catch (error) {
            this.log(`Error in BlockProposals run: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
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

        this.log("BlockProposals started");

        // Run immediately
        this.run().then();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log("BlockProposals stopped");
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName('BlockProposals'), "service starting using redis url: ", redisUrl);

    BlockProposals.create(redisUrl).then(() => {
        console.log(new Date(), padClassName('BlockProposals'), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName('BlockProposals'), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = BlockProposals;
