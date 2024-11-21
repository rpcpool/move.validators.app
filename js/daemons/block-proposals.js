const BaseDaemon = require("./base-daemon");

class BlockProposals extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.seconds = 60;
        this.interval = undefined;
        this.network = aptos.config.network;
        this.lastProcessedHeight = 0;
        this.rateLimit = 400; // since a lot of block are pulled, we need to throttle more
    }

    async fetchLedgerInfo() {
        const url = `https://api.${this.network}.aptoslabs.com/v1/`;
        try {
            const ledgerInfo = await this.fetchWithDelay(url, this.rateLimit);
            return {
                currentHeight: parseInt(ledgerInfo.block_height),
                oldestHeight: parseInt(ledgerInfo.oldest_block_height)
            };
        } catch (error) {
            this.log(`Error fetching ledger info: ${error.message}`);
            return null;
        }
    }

    async fetchLatestBlocks() {
        try {
            const ledgerInfo = await this.fetchLedgerInfo();
            if (!ledgerInfo) return [];

            const currentHeight = ledgerInfo.currentHeight;

            // Start from last processed height or oldest available height
            let startHeight = this.lastProcessedHeight || ledgerInfo.oldestHeight;
            // Don't process more than 100 blocks at once to avoid overload
            startHeight = Math.max(startHeight, currentHeight - 100);

            let blocks = [];
            for (let height = startHeight + 1; height <= currentHeight; height++) {
                await this.sleep(this.rateLimit);
                const blockUrl = `https://api.${this.network}.aptoslabs.com/v1/blocks/by_height/${height}?with_transactions=true`;
                const block = await this.fetchWithDelay(blockUrl, this.rateLimit);

                // Find the block_metadata_transaction
                const blockMetadataTransaction = block.transactions?.find(tx => tx.type === 'block_metadata_transaction');

                // Extract the epoch from block metadata transaction
                const epoch = blockMetadataTransaction?.epoch || null;

                // Find the NewBlockEvent in the block's events if available
                const newBlockEvent = blockMetadataTransaction?.events?.find(event =>
                    event.type === '0x1::block::NewBlockEvent'
                );

                // Get validator_address (proposer) from the NewBlockEvent data
                const proposer = newBlockEvent?.data?.proposer;

                if (!proposer) {
                    this.log(`Warning: Block ${height} missing proposer. Block data: ${JSON.stringify(block)}`);
                }

                if (!epoch) {
                    this.log(`Warning: Block ${height} missing epoch. Block data: ${JSON.stringify(block)}`);
                }

                blocks.push({
                    block_height: block.block_height,
                    block_hash: block.block_hash,
                    block_timestamp: block.block_timestamp,
                    first_version: block.first_version,
                    last_version: block.last_version,
                    validator_address: proposer,
                    epoch: epoch,  // Include the extracted epoch
                    raw_data: JSON.stringify(block)  // Store raw data for reference
                });
            }

            this.lastProcessedHeight = currentHeight;
            return blocks;
        } catch (error) {
            this.log(`Error fetching blocks: ${error.message}`);
            this.log(`Error stack: ${error.stack}`);

            // If there's a response object, log it
            if (error.response) {
                this.log(`Response status: ${error.response.status}`);
                this.log(`Response headers: ${JSON.stringify(error.response.headers)}`);
                this.log(`Response data: ${JSON.stringify(error.response.data)}`);
            }

            // If we were in the middle of processing a specific block
            if (height) {
                this.log(`Failed at block height: ${height}`);
                this.log(`Block URL that failed: https://api.${this.network}.aptoslabs.com/v1/blocks/by_height/${height}?with_transactions=true`);
            }

            return [];
        }
    }

    async run() {
        this.running = true;
        this.log("BlockProposals run started");

        try {
            const blocks = await this.fetchLatestBlocks();

            if (blocks.length > 0) {
                await this.jobDispatcher.enqueue("BlockProposalsJob", {blocks});
                this.log(`Enqueued ${blocks.length} new block proposals from height ${blocks[0].block_height} to ${blocks[blocks.length - 1].block_height}`);
            }

        } catch (error) {
            this.log(`Error in BlockProposals run: ${error.message}`);
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

        this.log("BlockProposals started");
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
    new BlockProposals(redisUrl);
} else {
    console.log(new Date(), "BlockProposals detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = BlockProposals;