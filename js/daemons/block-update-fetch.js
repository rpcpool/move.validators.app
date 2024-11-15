const BaseDaemon = require("./base-daemon");

class BlockUpdateFetch extends BaseDaemon {
    constructor(redisClient, pubSubClient, jobDispatcher, aptos) {
        super(redisClient, pubSubClient, jobDispatcher, aptos);

        this.network = aptos.config.network;
        this.rateLimit = 0; // no sleep
    }

    async fetchBlockForVersion(version) {
        const url = `https://api.${this.network}.aptoslabs.com/v1/blocks/by_version/${version}?with_transactions=true`;
        try {
            const block = await this.fetchWithDelay(url, this.rateLimit);

            // Find block_metadata_transaction to get epoch
            const blockMetadataTransaction = block.transactions?.find(
                tx => tx.type === 'block_metadata_transaction'
            );

            return {
                block_height: block.block_height,
                block_hash: block.block_hash,
                block_timestamp: block.block_timestamp,
                first_version: block.first_version,
                last_version: block.last_version,
                epoch: blockMetadataTransaction?.epoch,
                validator_address: blockMetadataTransaction?.proposer,
                raw_data: JSON.stringify(block)
            };
        } catch (error) {
            this.log(`Error fetching block for version ${version}: ${error.message}`);
            this.log(` url: ${url}`);
            return null;
        }
    }

    async run() {
        try {
            await this.jobDispatcher.listen("BlockFetchRequest", async (data) => {
                const {version} = data;
                this.log(`BlockFetchRequest received request for version ${version}`);

                const blockData = await this.fetchBlockForVersion(version);
                if (blockData && blockData.epoch) {

                    // Each update job will be responsible for upserting the block info since
                    // it needs to happen at the same time as the update does.

                    // Tumble through the various id's to see where we dispatch back to
                    if (data.stake_history_id) {
                        const stakeHistoryId = data.stake_history_id;
                        this.log(`BlockFetchRequest dispatching StakeHistoryUpdateJob for stake history id ${stakeHistoryId} and epoch ${blockData.epoch}`);
                        // Queue stake history update
                        await this.jobDispatcher.enqueue("StakeHistoryUpdateJob", {
                            stake_history_id: stakeHistoryId,
                            epoch: blockData.epoch
                        });
                    }
                } else {
                    this.log(`Error: block data epoch is missing: ${JSON.stringify(blockData)}`);
                }
            });
        } catch (error) {
            this.log(`Error in BlockUpdateFetch: ${error.message}`);
        }
    }

    start() {
        this.run().then();
        this.log("BlockUpdateFetch started");
    }

    stop() {
        this.log("BlockUpdateFetch stopped");
    }
}

module.exports = BlockUpdateFetch;