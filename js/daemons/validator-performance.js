const BaseDaemon = require("./base-daemon");
const {padClassName} = require('../lib/utils');

const railsJob = "ValidatorPerformanceJob";

class ValidatorPerformance extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.running = false;
        this.seconds = 900; // 15 minutes
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

        this.log('ValidatorPerformance daemon started');
    }

    /**
     * Stop the daemon
     */
    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.running = false;
        this.log('ValidatorPerformance daemon stopping');
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
        this.log("ValidatorPerformance run started");

        try {
            const currentEpoch = await this.getCurrentEpoch();
            if (!currentEpoch) {
                this.log("Failed to get current epoch");
                return;
            }

            // Process last epoch data
            const lastEpochData = await this.fetchLastEpochPerformance();
            if (lastEpochData.epoch && lastEpochData.validators.length) {
                const lastEpochPerformances = await this.processPerformanceData(
                    lastEpochData.validators,
                    lastEpochData.performance,
                    lastEpochData.epoch
                );

                await this.jobDispatcher.enqueue(railsJob, {
                    epoch: lastEpochData.epoch,
                    performances: lastEpochPerformances
                });
                this.log(`Enqueued last epoch ${lastEpochData.epoch} performances`);
            } else {
                this.log(`Last epoch data missing epoch or validators: epoch=${lastEpochData.epoch}, validators=${lastEpochData.validators.length}`);
            }

            // Process current epoch data
            const {performance, validators} = await this.fetchValidatorPerformance();
            if (performance.length && validators.length) {
                const currentPerformances = await this.processPerformanceData(
                    validators,
                    performance,
                    currentEpoch
                );

                await this.jobDispatcher.enqueue(railsJob, {
                    epoch: currentEpoch,
                    performances: currentPerformances
                });
                this.log(`Enqueued current epoch ${currentEpoch} performances`);
            } else {
                this.log(`Current performance data missing: performance=${performance.length}, validators=${validators.length}`);
            }

            this.log("ValidatorPerformance run complete");
        } catch (error) {
            this.log(`Error in ValidatorPerformance run: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
        } finally {
            this.running = false;
        }
    }

    /**
     * Validate last epoch data format
     */
    validateLastEpochData(json) {
        if (!json?.data?.last_completed?.vec?.[0]?.metadata) {
            return false;
        }

        const metadata = json.data.last_completed.vec[0].metadata;
        return typeof metadata.dealer_epoch === 'string' &&
               Array.isArray(metadata.dealer_validator_set) &&
               metadata.dealer_validator_set.every(v => 
                   v.addr && typeof v.addr === 'string' &&
                   v.voting_power && typeof v.voting_power === 'string'
               );
    }

    /**
     * Validate performance data format
     */
    validatePerformanceData(json) {
        if (!Array.isArray(json)) return false;
        
        const performanceResource = json.find(r => r.type === "0x1::stake::ValidatorPerformance");
        const validatorSetResource = json.find(r => r.type === "0x1::stake::ValidatorSet");

        if (!performanceResource?.data?.validators || !validatorSetResource?.data?.active_validators) {
            return false;
        }

        return performanceResource.data.validators.every(v =>
            typeof v.successful_proposals === 'string' &&
            typeof v.failed_proposals === 'string'
        ) && validatorSetResource.data.active_validators.every(v =>
            typeof v.addr === 'string' &&
            typeof v.voting_power === 'string'
        );
    }

    /**
     * Fetch last epoch and validator data
     */
    async fetchLastEpochAndValidators() {
        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::dkg::DKGState`;
            const json = await this.fetchWithQueue(url);
            
            if (!this.validateLastEpochData(json)) {
                throw new Error('Invalid last epoch data format');
            }

            const lastCompleted = json.data.last_completed.vec[0];
            this.log(`Last completed epoch: ${lastCompleted.metadata.dealer_epoch}`);

            return {
                lastEpoch: lastCompleted.metadata.dealer_epoch,
                validators: lastCompleted.metadata.dealer_validator_set
            };
        } catch (error) {
            this.log(`Error fetching last epoch and validators: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return {lastEpoch: null, validators: []};
        }
    }

    /**
     * Fetch last epoch performance data
     */
    async fetchLastEpochPerformance() {
        try {
            const {lastEpoch, validators} = await this.fetchLastEpochAndValidators();
            if (lastEpoch === null) {
                this.log(`Error: Last epoch was null, cannot continue with performance`);
                return {
                    epoch: null,
                    validators: [],
                    performance: []
                };
            }

            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resources?ledger_version=${lastEpoch}`;
            const resources = await this.fetchWithQueue(url);

            if (!this.validatePerformanceData(resources)) {
                throw new Error('Invalid performance data format');
            }

            const lastEpochPerf = resources.find(r => r.type === "0x1::stake::ValidatorPerformance");
            return {
                epoch: lastEpoch,
                validators: validators,
                performance: lastEpochPerf?.data.validators || []
            };
        } catch (error) {
            this.log(`Error fetching last epoch performance: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return {
                epoch: null,
                validators: [],
                performance: []
            };
        }
    }

    /**
     * Fetch current validator performance data
     */
    async fetchValidatorPerformance() {
        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resources`;
            const resources = await this.fetchWithQueue(url);

            if (!this.validatePerformanceData(resources)) {
                throw new Error('Invalid performance data format');
            }

            const performanceResource = resources.find(
                (resource) => resource.type === "0x1::stake::ValidatorPerformance"
            );

            const validatorSetResource = resources.find(
                (resource) => resource.type === "0x1::stake::ValidatorSet"
            );

            return {
                performance: performanceResource?.data.validators || [],
                validators: validatorSetResource?.data.active_validators || []
            };
        } catch (error) {
            this.log(`Error fetching validator performance: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return {performance: [], validators: []};
        }
    }

    /**
     * Get current epoch
     */
    async getCurrentEpoch() {
        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::reconfiguration::Configuration`;
            const config = await this.fetchWithQueue(url);
            
            if (!config?.data?.epoch || typeof config.data.epoch !== 'string') {
                throw new Error('Invalid epoch data format');
            }

            return config.data.epoch;
        } catch (error) {
            this.log(`Error getting epoch: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return null;
        }
    }

    /**
     * Process performance data for validators
     */
    async processPerformanceData(validators, performance, epoch) {
        const processedPerformances = [];

        for (const validator of validators) {
            try {
                const perf = performance.find(p => p && typeof p.successful_proposals !== 'undefined') || 
                            { successful_proposals: '0', failed_proposals: '0' };

                const successful = parseInt(perf.successful_proposals || '0');
                const failed = parseInt(perf.failed_proposals || '0');
                const total = successful + failed;

                processedPerformances.push({
                    validator_address: validator.addr,
                    voting_power: validator.voting_power,
                    successful_proposals: successful,
                    total_proposals: total,
                    epoch: epoch
                });

                this.log(`Processed performance for validator ${validator.addr}`);
            } catch (error) {
                this.log(`Error processing performance for validator ${validator.addr}: ${error.message}`);
                if (error.stack) {
                    this.log(`Stack trace: ${error.stack}`);
                }
            }
        }

        return processedPerformances;
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName('ValidatorPerformance'), "service starting using redis url: ", redisUrl);

    ValidatorPerformance.create(redisUrl).then(() => {
        console.log(new Date(), padClassName('ValidatorPerformance'), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName('ValidatorPerformance'), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorPerformance;
