const BaseDaemon = require("./base-daemon");
const AptosCliWrapper = require("../lib/console/aptos-cli-wrapper");
const {padClassName} = require('../lib/utils');

class ValidatorRewards extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.running = false;
        this.seconds = 120; // 2 minute interval
        this.interval = undefined;
        this.cache = {};
        this.aptosCliWrapper = new AptosCliWrapper();
        this.network = aptos.config.network;
        this.versionInfoCache = new Map();
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

        this.log('ValidatorRewards daemon started');
    }

    /**
     * Stop the daemon
     */
    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        if (this.jobDispatcher) {
            this.jobDispatcher.unsubscribe("ValidatorHistoricalRewardsJob");
        }
        this.running = false;
        this.log('ValidatorRewards daemon stopping');
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
        this.log("ValidatorRewards run started");

        try {
            // Listen for historical rewards requests
            await this.jobDispatcher.listen("ValidatorHistoricalRewardsJob", (data) => {
                this.handleHistoricalRewardsRequest(data);
            });

            const validators = await this.fetchValidatorSet();
            if (!validators || validators.length === 0) {
                this.log("No validators found");
                return;
            }

            this.log(`Processing rewards for ${validators.length} active validators`);
            
            const validatorRewards = {};
            let validatorsWithRewards = 0;
            let totalRewardsFound = 0;

            // Process each validator
            for (const validator of validators) {
                try {
                    const result = await this.processValidatorRewards(validator);
                    if (result.rewards.length > 0) {
                        validatorRewards[validator.addr] = result;
                        validatorsWithRewards++;
                        totalRewardsFound += result.rewards.length;
                    }
                } catch (error) {
                    this.log(`Error processing validator ${validator.addr}: ${error.message}`);
                    if (error.stack) {
                        this.log(`Stack trace: ${error.stack}`);
                    }
                }
            }

            if (validatorsWithRewards > 0) {
                this.log(`Found rewards for ${validatorsWithRewards} validators with ${totalRewardsFound} total rewards`);
                this.log(`Enqueueing rewards job with ${Object.keys(validatorRewards).length} validators`);
                
                try {
                    const jid = await this.jobDispatcher.enqueue("ValidatorRewardsJob", validatorRewards);
                    this.log(`Successfully enqueued rewards job ${jid}`);
                } catch (error) {
                    this.log(`Failed to enqueue rewards job: ${error.message}`);
                    if (error.stack) {
                        this.log(`Stack trace: ${error.stack}`);
                    }
                    throw error;
                }
            } else {
                this.log('No validators had rewards, skipping job enqueue');
            }

        } catch (error) {
            this.log(`Error in ValidatorRewards run: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
        } finally {
            this.running = false;
        }
    }

    /**
     * Fetch active validator set
     */
    async fetchValidatorSet() {
        const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::stake::ValidatorSet`;
        try {
            const response = await this.fetchWithQueue(url);
            return response.data.active_validators;
        } catch (error) {
            this.log(`Error fetching validator set: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }

    /**
     * Process rewards for a single validator
     */
    async processValidatorRewards(validator) {
        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/${validator.addr}/events/0x1::stake::StakePool/distribute_rewards_events`;
            const events = await this.fetchWithQueue(url);
            this.log(`Fetched ${events.length} reward events for validator ${validator.addr}`);

            if (events.length === 0) {
                return {
                    rewards: [],
                    voting_power: validator.voting_power?.toString()
                };
            }

            const rewards = await this.processRewardEvents(events);
            this.log(`Processed ${rewards.length} rewards for validator ${validator.addr}`);

            return {
                rewards,
                voting_power: validator.voting_power?.toString()
            };
        } catch (error) {
            this.log(`Error processing validator rewards for ${validator.addr}: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return {
                rewards: [],
                voting_power: validator.voting_power?.toString()
            };
        }
    }

    /**
     * Process reward events and fetch associated version data
     */
    async processRewardEvents(events) {
        try {
            const versions = events.map(event => event.version);
            const versionDataMap = await this.fetchVersionData(versions);
            
            return events
                .map(event => {
                    const versionData = versionDataMap.get(event.version);
                    if (versionData) {
                        return {
                            version: event.version.toString(),
                            sequence: event.sequence_number.toString(),
                            amount: event.data.rewards_amount.toString(),
                            version_info: versionData
                        };
                    }
                    return null;
                })
                .filter(reward => reward !== null);
        } catch (error) {
            this.log(`Error processing reward events: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }

    /**
     * Fetch version data for multiple versions
     */
    async fetchVersionData(versions) {
        const uniqueVersions = [...new Set(versions)];
        const results = new Map();

        for (const version of uniqueVersions) {
            if (this.versionInfoCache.has(version)) {
                results.set(version, this.versionInfoCache.get(version));
                continue;
            }

            try {
                const url = `https://api.${this.network}.aptoslabs.com/v1/blocks/by_version/${version}`;
                const data = await this.fetchWithQueue(url);
                
                if (!this.validateVersionData(data)) {
                    throw new Error('Invalid version data format');
                }

                const versionData = {
                    block_timestamp: data.block_timestamp.toString(),
                    block_height: data.block_height.toString(),
                    datetime: new Date(Math.floor(parseInt(data.block_timestamp) / 1000000)).toISOString()
                };

                this.versionInfoCache.set(version, versionData);
                results.set(version, versionData);
            } catch (error) {
                this.log(`Error fetching version data for ${version}: ${error.message}`);
                if (error.stack) {
                    this.log(`Stack trace: ${error.stack}`);
                }
                results.set(version, null);
            }
        }

        return results;
    }

    /**
     * Validate version data has required fields
     */
    validateVersionData(data) {
        const requiredFields = ['block_timestamp', 'block_height'];
        return requiredFields.every(field => 
            data.hasOwnProperty(field) && 
            data[field] !== null && 
            data[field] !== undefined
        );
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName('ValidatorRewards'), "service starting using redis url: ", redisUrl);

    ValidatorRewards.create(redisUrl).then(() => {
        console.log(new Date(), padClassName('ValidatorRewards'), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName('ValidatorRewards'), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorRewards;
