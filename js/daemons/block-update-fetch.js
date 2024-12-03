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
            const block = await this.fetchWithQueue(url, this.rateLimit);

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
            // Move the listener outside the while loop
            await this.jobDispatcher.listen("BlockFetchRequest", async (data) => {
                const {version} = data;
                this.log(`BlockFetchRequest received request for version ${version}`);

                const blockData = await this.fetchBlockForVersion(version);
                if (blockData && blockData.epoch) {
                    if (data.stake_history_id) {
                        const stakeHistoryId = data.stake_history_id;
                        this.log(`BlockFetchRequest dispatching StakeHistoryUpdateJob for stake history id ${stakeHistoryId} and epoch ${blockData.epoch}`);
                        await this.jobDispatcher.enqueue("StakeHistoryUpdateJob", {
                            stake_history_id: stakeHistoryId,
                            epoch: blockData.epoch
                        });
                    }
                } else {
                    this.log(`Error: block data epoch is missing: ${JSON.stringify(blockData)}`);
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