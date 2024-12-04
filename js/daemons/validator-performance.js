const BaseDaemon = require("./base-daemon");

class ValidatorPerformance extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.seconds = 900; // 15 minutes
        this.interval = undefined;
        this.network = aptos.config.network;
    }

    async fetchLastEpochAndValidators() {
        const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::dkg::DKGState`;

        try {
            const json = await this.fetchWithQueue(url, this.rateLimit);
            const lastCompleted = json.data.last_completed.vec[0];

            return {
                lastEpoch: lastCompleted.metadata.dealer_epoch,
                validators: lastCompleted.metadata.dealer_validator_set
            };
        } catch (error) {
            this.log(`Error fetching last epoch and validators: ${error.message}`);
            return {lastEpoch: null, validators: []};
        }
    }

    async fetchLastEpochPerformance() {
        try {
            const {lastEpoch, validators} = await this.fetchLastEpochAndValidators();
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resources?ledger_version=${lastEpoch}`;

            const resources = await this.fetchWithQueue(url, this.rateLimit);
            const lastEpochPerf = resources.find(r => r.type === "0x1::stake::ValidatorPerformance");

            return {
                epoch: lastEpoch,
                validators: validators,
                performance: lastEpochPerf?.data.validators || []
            };
        } catch (error) {
            this.log(`Error fetching last epoch performance: ${error.message}`);
            return {
                epoch: null,
                validators: [],
                performance: []
            };
        }
    }

    async fetchValidatorPerformance() {
        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resources`;
            const resources = await this.fetchWithQueue(url, this.rateLimit);

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
            return {performance: [], validators: []};
        }
    }

    async getCurrentEpoch() {
        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::reconfiguration::Configuration`;
            const config = await this.fetchWithQueue(url, this.rateLimit);
            return config.data.epoch;
        } catch (error) {
            this.log(`Error getting epoch: ${error.message}`);
            return null;
        }
    }

    async run() {
        this.running = true;
        this.log("ValidatorPerformance run started");

        try {
            const currentEpoch = await this.getCurrentEpoch();
            if (!currentEpoch) return;

            // This tries to fetch the last epoch and validators performance
            const lastEpochData = await this.fetchLastEpochPerformance();
            if (lastEpochData.epoch && lastEpochData.validators.length) {
                const lastEpochPerformances = lastEpochData.validators.map((validator) => {
                    const perfIndex = lastEpochData.performance.findIndex(p => p && typeof p.successful_proposals !== 'undefined');
                    const perf = perfIndex >= 0 ? lastEpochData.performance[perfIndex] : {
                        successful_proposals: '0',
                        failed_proposals: '0'
                    };

                    return {
                        validator_address: validator.addr,
                        voting_power: validator.voting_power,
                        successful_proposals: parseInt(perf.successful_proposals || '0'),
                        total_proposals: parseInt(perf.successful_proposals || '0') + parseInt(perf.failed_proposals || '0'),
                        epoch: lastEpochData.epoch
                    };
                });

                await this.jobDispatcher.enqueue("ValidatorPerformanceJob", {
                    epoch: lastEpochData.epoch,
                    performances: lastEpochPerformances
                });

            } else {
                this.log(`ValidatorPerformance lastEpochData missing epoch? ${lastEpochData.epoch} or lastEpochData.validators 0 ? ${lastEpochData.validators.length}`);
            }

            // Fetches current ongoing performance
            const {performance, validators} = await this.fetchValidatorPerformance();
            if (performance.length && validators.length) {
                const currentPerformances = validators.map((validator) => {
                    const perf = performance.find(p => p && typeof p.successful_proposals !== 'undefined') ||
                        {successful_proposals: '0', failed_proposals: '0'};

                    return {
                        validator_address: validator.addr,
                        voting_power: validator.voting_power,
                        successful_proposals: parseInt(perf.successful_proposals || '0'),
                        total_proposals: parseInt(perf.successful_proposals || '0') + parseInt(perf.failed_proposals || '0'),
                        epoch: currentEpoch
                    };
                });

                await this.jobDispatcher.enqueue("ValidatorPerformanceJob", {
                    epoch: currentEpoch,
                    performances: currentPerformances
                });
            } else {
                this.log(`ValidatorPerformance performance length 0? ${performance.length} or validators 0 ? ${validators.length}`);
            }

            this.log("ValidatorPerformance run finished");
        } catch (error) {
            this.log(`Error in run: ${error.message}`);
            this.log(`${error.stack}`);
        } finally {
            this.running = false;
        }
    }

    start() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            if (!this.running) this.run().then();
        }, this.seconds * 1000);
        this.run().then();

        this.log("ValidatorsPerformance started");
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), "ValidatorPerformance service starting using redis url: ", redisUrl);

    ValidatorPerformance.create(redisUrl).then(() => {
        console.log(new Date(), "ValidatorPerformance service start complete.");
    });
} else {
    console.log(new Date(), "ValidatorPerformance detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorPerformance;