const fs = require('fs');
const path = require('path');
const BaseDaemon = require("./base-daemon");
const AptosCliWrapper = require("../lib/console/aptos-cli-wrapper");

class ValidatorRewards extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.seconds = 120;
        this.interval = undefined;
        this.cache = {};
        this.aptosCliWrapper = new AptosCliWrapper();
        this.network = aptos.config.network;
    }

    async fetchVersionData(version) {
        const url = `https://api.${this.network}.aptoslabs.com/v1/blocks/by_version/${version}`;
        try {
            const json = await this.fetchWithDelay(url, this.rateLimit);

            return {
                block_timestamp: json.block_timestamp,
                block_height: json.block_height,
                datetime: new Date(Math.floor(parseInt(json.block_timestamp) / 1000))
            };
        } catch (error) {
            this.log(`Error fetching version data for ${version}: ${error.message}`);
            return null;
        }
    }

    async run() {
        this.running = true;
        this.log("ValidatorsList run started");

        let validators = {};

        try {
            // get current validators
            let url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::stake::ValidatorSet`;
            const json = await this.fetchWithDelay(url, this.rateLimit);
            const activeValidators = json.data.active_validators;

            for (let validator of activeValidators) {
                // this.log(`Validator: ${JSON.stringify(validator)}`);
                // get the reward events
                url = `https://api.${this.network}.aptoslabs.com/v1/accounts/${validator.addr}/events/0x1::stake::StakePool/distribute_rewards_events`;
                const json = await this.fetchWithDelay(url, this.rateLimit);

                validator.rewards = json.map((event) => {
                    return {
                        version: event.version,
                        sequence: event.sequence_number,
                        amount: event.data.rewards_amount
                    }
                });

                // Fetch version data for each of the rewards
                if (validator.rewards.length > 0) {
                    for (let reward of validator.rewards) {
                        reward.version_info = await this.fetchVersionData(reward.version);
                    }
                }

                validators[validator.addr] = validator;
                this.log(`Rewards updated and enqueued for: ${validator.addr}`);
                // console.log("");
                // console.log(JSON.stringify(validator, null, 2));
                // console.log("");
            }

            await this.jobDispatcher.enqueue("ValidatorRewardsJob", validators);

        } catch (error) {
            console.error('Error fetching validator rewards:', error);
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

        // run immediately
        this.run().then();

        this.log("ValidatorsList started");
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log("ValidatorsList stopped");
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    new ValidatorRewards(redisUrl);
} else {
    console.log(new Date(), "ValidatorRewards detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorRewards;