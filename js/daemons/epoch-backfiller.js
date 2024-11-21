const BaseDaemon = require("./base-daemon");

class EpochBackfiller extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.network = aptos.config.network;
        this.blocksPerBatch = 250;
        this.concurrentBatches = 3; // Add parallel processing?
        this.expectedBlocksPerEpoch = 6000;
        this.blockMarginOfError = 500;  // Allow 500 blocks from expected
    }

    async fetchLedgerInfo() {
        const url = `https://api.${this.network}.aptoslabs.com/v1/`;
        try {
            const ledgerInfo = await this.fetchWithDelay(url, this.rateLimit);
            return {
                currentEpoch: parseInt(ledgerInfo.epoch),
                currentHeight: parseInt(ledgerInfo.block_height),
                oldestHeight: parseInt(ledgerInfo.oldest_block_height)
            };
        } catch (error) {
            this.log(`Error fetching ledger info: ${error.message}`);
            return null;
        }
    }

    async getEpochBoundaries(targetEpoch) {
        try {
            const ledgerInfo = await this.fetchLedgerInfo();
            if (!ledgerInfo) throw new Error("Could not fetch ledger info");

            this.log(`Ledger Info: ${JSON.stringify(ledgerInfo)}`);
            this.log(`Current Chain Height: ${ledgerInfo.currentHeight}`);
            this.log(`Target Epoch: ${targetEpoch}\n`);

            let epochStartHeight = null;
            let epochEndHeight = null;
            const LIMIT = 100;
            const MAX_ATTEMPTS = 10;
            let attempts = 0;

            // Calculate an estimated starting point
            // Assuming each epoch is ~6000 blocks
            const currentEpoch = parseInt(ledgerInfo.currentEpoch);
            const epochDiff = currentEpoch - targetEpoch;
            let startSequence = Math.max(0, ledgerInfo.currentHeight - (epochDiff * 6000));

            this.log(`Current epoch: ${currentEpoch}`);
            this.log(`Looking for epoch: ${targetEpoch} (${epochDiff} epochs ago)`);
            this.log(`Starting search at block ~${startSequence}\n`);

            while ((!epochStartHeight || !epochEndHeight) && attempts < MAX_ATTEMPTS) {
                attempts++;
                this.log(`\nAttempt ${attempts} of ${MAX_ATTEMPTS}`);

                const blockEventUrl = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/events/0x1::block::BlockResource/new_block_events?start=${startSequence}&limit=${LIMIT}`;
                const events = await this.fetchWithDelay(blockEventUrl, this.rateLimit);

                if (events.length === 0) {
                    this.log("No events found.");
                    break;
                }

                // Log the epoch range we found in this batch
                const firstEvent = events[0];
                const lastEvent = events[events.length - 1];
                this.log(`Found events from epoch ${firstEvent.data.epoch} to ${lastEvent.data.epoch}`);
                this.log(`Block heights ${lastEvent.data.height} to ${firstEvent.data.height}`);

                for (const event of events) {
                    const eventEpoch = parseInt(event.data.epoch);
                    const blockHeight = parseInt(event.data.height);

                    if (eventEpoch === targetEpoch && !epochEndHeight) {
                        epochEndHeight = blockHeight;
                        this.log(`Found end height: ${blockHeight} (Epoch ${eventEpoch})`);
                    } else if (eventEpoch === targetEpoch - 1 && !epochStartHeight) {
                        epochStartHeight = blockHeight + 1;
                        this.log(`Found start height: ${epochStartHeight} (After Epoch ${eventEpoch})`);
                    }
                }

                // If we haven't found our epoch, make bigger jumps
                if (!epochEndHeight) {
                    startSequence = Math.max(0, startSequence - 1000);
                } else if (!epochStartHeight) {
                    // Once we find the end, take smaller steps to find the start
                    startSequence = Math.max(0, startSequence - LIMIT);
                }
            }

            if (epochStartHeight && epochEndHeight) {
                this.log("\nFound epoch boundaries:");
                this.log(`Start Height: ${epochStartHeight}`);
                this.log(`End Height: ${epochEndHeight}`);
                this.log(`Total Blocks: ${epochEndHeight - epochStartHeight + 1}`);

                return {
                    startBlock: epochStartHeight,
                    endBlock: epochEndHeight
                };
            }

            throw new Error(`Could not find complete epoch boundaries for epoch ${targetEpoch} within ${MAX_ATTEMPTS} attempts`);

        } catch (error) {
            this.log(`Error finding epoch boundaries: ${error.message}`);
            return null;
        }
    }

    async analyzeBackfillJob(targetEpoch = null) {
        try {
            const ledgerInfo = await this.fetchLedgerInfo();
            if (!ledgerInfo) {
                throw new Error("Could not fetch ledger info");
            }

            // If no target epoch provided, use current
            const epoch = targetEpoch || ledgerInfo.currentEpoch;

            // Get epoch boundaries
            const boundaries = await this.getEpochBoundaries(epoch);
            if (!boundaries) {
                throw new Error(`Could not determine boundaries for epoch ${epoch}`);
            }

            const totalBlocks = boundaries.endBlock - boundaries.startBlock + 1;

            // New time estimation calculation:
            // With rate limit of 30/min and 3 concurrent batches of 250:
            // - We can process 30 requests per minute
            // - Each batch of 250 blocks is one request
            // - With 3 concurrent batches, we process 750 blocks per minute
            // const blocksPerMinute = (this.rateLimit * this.blocksPerBatch * this.concurrentBatches) / this.concurrentBatches;
            // const estimatedMinutes = Math.ceil(totalBlocks / blocksPerMinute);
            const blocksPerMinute = this.rateLimit * this.blocksPerBatch;  // 30 * 250 = 7500 blocks/minute
            const estimatedMinutes = Math.ceil(totalBlocks / blocksPerMinute);

            console.log("\nEpoch Backfill Analysis:");
            console.log(`Target Epoch: ${epoch}`);
            console.log(`Start Block: ${boundaries.startBlock}`);
            console.log(`End Block: ${boundaries.endBlock}`);
            console.log(`Total Blocks: ${totalBlocks}`);
            console.log(`Processing Rate: ~${blocksPerMinute} blocks/minute`);
            console.log(`Estimated Time: ~${estimatedMinutes} minutes`);
            console.log(`Batch Size: ${this.blocksPerBatch}`);
            console.log(`Concurrent Batches: ${this.concurrentBatches}`);
            console.log(`Rate Limit: ${this.rateLimit} requests/minute\n`);

            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                readline.question('Proceed with backfill? (yes/no): ', async (answer) => {
                    readline.close();
                    if (answer.toLowerCase() === 'yes') {
                        console.log("Starting backfill...");
                        await this.backfillEpoch(epoch, boundaries);
                    } else {
                        console.log("Backfill cancelled.");
                    }
                    resolve();
                });
            });
        } catch (error) {
            this.log(`Error analyzing backfill job: ${error.message}`);
        }
    }

    async processBatch(startHeight, endHeight) {
        const blocks = [];
        for (let blockHeight = startHeight; blockHeight <= endHeight; blockHeight++) {
            try {
                const blockUrl = `https://api.${this.network}.aptoslabs.com/v1/blocks/by_height/${blockHeight}?with_transactions=true`;
                const block = await this.fetchWithDelay(blockUrl, this.rateLimit);

                const blockMetadataTransaction = block.transactions?.find(tx =>
                    tx.type === 'block_metadata_transaction'
                );
                const newBlockEvent = blockMetadataTransaction?.events?.find(event =>
                    event.type === '0x1::block::NewBlockEvent'
                );

                blocks.push({
                    block_height: block.block_height,
                    block_hash: block.block_hash,
                    block_timestamp: block.block_timestamp,
                    first_version: block.first_version,
                    last_version: block.last_version,
                    validator_address: newBlockEvent?.data?.proposer,
                    epoch: blockMetadataTransaction?.epoch,
                    raw_data: JSON.stringify(block)
                });
            } catch (error) {
                this.log(`Error processing block ${blockHeight}: ${error.message}`);
            }
        }
        return blocks;
    }

    async backfillEpoch(epoch, boundaries) {
        try {
            const totalBlocks = boundaries.endBlock - boundaries.startBlock + 1;
            let processedBlocks = 0;

            // Process blocks in parallel batches
            for (let height = boundaries.startBlock; height <= boundaries.endBlock; height += (this.blocksPerBatch * this.concurrentBatches)) {
                const batchPromises = [];

                // Create concurrent batch promises
                for (let i = 0; i < this.concurrentBatches; i++) {
                    const batchStart = height + (i * this.blocksPerBatch);
                    if (batchStart <= boundaries.endBlock) {
                        const batchEnd = Math.min(batchStart + this.blocksPerBatch - 1, boundaries.endBlock);
                        batchPromises.push(this.processBatch(batchStart, batchEnd));
                    }
                }

                // Wait for all batches to complete
                const batchResults = await Promise.all(batchPromises);

                // Flatten and filter out empty results
                const blocks = batchResults.flat().filter(Boolean);

                if (blocks.length > 0) {
                    await this.jobDispatcher.enqueue("BlockProposalsJob", {blocks});
                    processedBlocks += blocks.length;
                    const progress = ((processedBlocks / totalBlocks) * 100).toFixed(2);
                    this.log(`Progress: ${progress}% (${processedBlocks}/${totalBlocks} blocks)`);
                }
            }
        } catch (error) {
            this.log(`Error in backfill process: ${error.message}`);
        }
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    new EpochBackfiller(redisUrl);
} else {
    console.log(new Date(), "EpochBackfiller detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = EpochBackfiller;