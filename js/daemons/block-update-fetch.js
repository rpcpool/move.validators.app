const BaseDaemon = require("./base-daemon");

class BlockUpdateFetch extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);

        this.network = aptos.config.network;
        this.rateLimit = 0; // no sleep
        this.started = false;
    }

    async fetchBlockForVersion(version) {
        const url = `https://api.${this.network}.aptoslabs.com/v1/blocks/by_version/${version}?with_transactions=true`;
        try {
            this.log(`Fetching block for version ${version}`);
            const block = await this.fetchWithQueue(url, this.rateLimit);

            if (!block || !block.transactions) {
                this.log(`Invalid block data received for version ${version}`);
                return null;
            }

            // Find block_metadata_transaction to get epoch
            const blockMetadataTransaction = block.transactions.find(
                tx => tx.type === 'block_metadata_transaction'
            );

            if (!blockMetadataTransaction || !blockMetadataTransaction.epoch) {
                this.log(`No valid block metadata transaction found for version ${version}`);
                return null;
            }

            const blockData = {
                block_height: block.block_height,
                block_hash: block.block_hash,
                block_timestamp: block.block_timestamp,
                first_version: block.first_version,
                last_version: block.last_version,
                epoch: blockMetadataTransaction.epoch,
                validator_address: blockMetadataTransaction.proposer,
                raw_data: JSON.stringify(block)
            };

            // Validate required fields
            const requiredFields = ['block_height', 'block_hash', 'block_timestamp', 'first_version', 'last_version', 'epoch'];
            const missingFields = requiredFields.filter(field => !blockData[field]);
            
            if (missingFields.length > 0) {
                this.log(`Missing required fields for version ${version}: ${missingFields.join(', ')}`);
                return null;
            }

            this.log(`Successfully parsed block data for version ${version} with epoch ${blockData.epoch}`);
            return blockData;
        } catch (error) {
            if (error.status === 429) {
                this.log(`Rate limited while fetching block for version ${version}`);
                // Add delay before retrying on rate limit
                await this.sleep(1000);
            } else {
                this.log(`Error fetching block for version ${version}: ${error.message}`);
                this.log(` url: ${url}`);
                if (error.status) {
                    this.log(` status: ${error.status}`);
                }
            }
            return null;
        }
    }

    async run() {
        try {
            // Move the listener outside the while loop
            await this.jobDispatcher.listen("BlockFetchRequest", async (data) => {
                const {version} = data;
                this.log(`BlockFetchRequest received request for version ${version}`);

                const blockData = await this.fetchBlockForVersion(version);
                if (blockData && blockData.epoch) {
                    if (data.stake_history_id) {
                        const stakeHistoryId = data.stake_history_id;
                        await this.jobDispatcher.enqueue("StakeHistoryUpdateJob", {
                            stake_history_id: stakeHistoryId,
                            epoch: blockData.epoch,
                            block: blockData // Pass full block data to update block record
                        });
                        this.log(`Enqueued StakeHistoryUpdateJob for stake history ${stakeHistoryId} with epoch ${blockData.epoch}`);
                    }
                } else {
                    this.log(`Failed to get valid block data for version ${version}`);
                }
            });

            // Keep the daemon alive
            while (this.started) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            this.log(`Error in BlockUpdateFetch: ${error.message}`);
            if (this.started) {  // Only restart if we're still supposed to be running
                await new Promise(resolve => setTimeout(resolve, 5000));
                return this.run();
            }
        }
    }

    start() {
        this.started = true;
        this.run().then();
        this.log("BlockUpdateFetch started");
    }

    stop() {
        this.started = false;
        this.log("BlockUpdateFetch stopped");
    }
}

if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), "BlockUpdateFetch service starting using redis url: ", redisUrl);

    BlockUpdateFetch.create(redisUrl).then(() => {
        console.log(new Date(), "BlockUpdateFetch service start complete.");
    });
} else {
    console.log(new Date(), "BlockUpdateFetch detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = BlockUpdateFetch;
