const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const BaseDaemon = require("./base-daemon");
const path = require('path');
const dotenvenc = require('@tka85/dotenvenc');

/**
 * The epoch history fetches and rolls up some data for each epoch.
 * Once the data is fetched, it is scrubbed/verified and then dropped on the queue to be processed
 * on the Rails side.
 */

class EpochHistory extends BaseDaemon {
    // Default seconds is 60
    constructor(redisUrlOrClient, seconds = 60) {
        super(redisUrlOrClient);
        this.seconds = seconds;
        this.interval = undefined;
        this.cache = {};
    }

    start() {
        // Call async initialize method
        this.initialize().then(() => {

            if (this.interval) {
                clearInterval(this.interval);
            }

            this.interval = setInterval(() => {
                this.run().then();
            }, this.seconds * 1000);

            // run immediately
            this.run().then();

            this.log("EpochHistory started");

        }).catch(err => {
            console.error("Failed to initialize EpochHistory:", err);
        });
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log("EpochHistory stopped");
    }

    async run() {
        this.log("EpochHistory run started");

        try {
            const resources = await this.aptos.account.getAccountResources({
                accountAddress: "0x1",
            });

            // Extract the Configuration object to get the current epoch
            const configuration = this.getItem(resources, "0x1::reconfiguration::Configuration").data;
            const currentEpoch = parseInt(configuration.epoch);

            // Extract the ValidatorPerformance object to get the validators count
            const validatorData = this.getItem(resources, "0x1::stake::ValidatorPerformance").data;
            const validatorsCount = validatorData.validators.length;

            // Extract the BlockResource object
            const blockResource = this.getItem(resources, "0x1::block::BlockResource").data;

            // Extract the necessary values from the BlockResource object
            const epochIntervalUs = parseInt(blockResource.epoch_interval);
            const currentHeight = parseInt(blockResource.height);

            // Calculate the number of blocks per epoch (assuming 1 block per second)
            const blocksPerEpoch = epochIntervalUs / 1000000; // Total blocks in an epoch

            // Calculate the starting slot of the current epoch
            const startingSlot = currentHeight - (currentHeight % blocksPerEpoch);

            // Extract the ValidatorSet object to get the total staked amount
            const validatorSet = this.getItem(resources, "0x1::stake::ValidatorSet").data;
            const totalStaked = validatorSet.total_voting_power;
            const averageValidatorStake = parseInt(totalStaked) / validatorsCount;

            // Extract the StakingRewardsConfig object
            const stakingRewardsConfig = this.getItem(resources, "0x1::staking_config::StakingRewardsConfig").data;

            // Extract necessary values as BigInt
            const currentRewardsRate = BigInt(stakingRewardsConfig.rewards_rate.value);
            const periodInSeconds = BigInt(stakingRewardsConfig.rewards_rate_period_in_secs);

            // TODO: Total rewards are still tbd - currently not sure how to decipher
            // const totalRewards = String(currentRewardsRate * periodInSeconds);

            const data = {
                currentEpoch,
                validatorsCount,
                startingSlot,
                blocksPerEpoch,
                currentHeight,
                totalStaked,
                averageValidatorStake,
                // totalRewards
            }

            await this.jobDispatcher.enqueue("EpochJob", data);

        } catch (error) {
            console.error("Error retrieving data:", error);
        }

        this.log("EpochHistory run complete");
    }

}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const env = process.env.NODE_ENV || 'development';
    const encryptedFilePath = path.resolve(process.cwd(), `.env.${env}.enc`);

    dotenvenc.decrypt({encryptedFile: encryptedFilePath})
        .then(() => {
            const redisUrl = process.env.REDIS_URL;
            new EpochHistory(redisUrl).start();
        });
} else {
    console.log(new Date(), "EpochHistory detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = EpochHistory;
