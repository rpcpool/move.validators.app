const BaseDaemon = require("./base-daemon");

class ValidatorPerformance extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.seconds = 900; // 15 minutes
        this.interval = undefined;
        this.network = aptos.config.network;
    }

    async fetchLastEpochAndValidators() {
        try {
            await this.sleep(this.rateLimit);
            const resource = await this.aptos.account.getAccountResource({
                accountAddress: "0x1",
                resourceType: "0x1::dkg::DKGState"
            });

            const lastCompleted = resource.last_completed.vec[0];
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
            await this.sleep(this.rateLimit);
            const {lastEpoch, validators} = await this.fetchLastEpochAndValidators();

            await this.sleep(this.rateLimit);
            const resources = await this.aptos.account.getAccountResources({
                accountAddress: "0x1",
                ledger_version: lastEpoch
            });
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
            await this.sleep(this.rateLimit);
            const resources = await this.aptos.account.getAccountResources({
                accountAddress: "0x1",
            });

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
            await this.sleep(this.rateLimit);
            const config = await this.aptos.account.getAccountResource({
                accountAddress: "0x1",
                resourceType: "0x1::reconfiguration::Configuration"
            });
            return config.epoch;
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
                const lastEpochPerformances = lastEpochData.validators.map((validator, index) => ({
                    validator_address: validator.addr,
                    voting_power: validator.voting_power,
                    successful_proposals: parseInt(lastEpochData.performance[index].successful_proposals),
                    total_proposals: parseInt(lastEpochData.performance[index].successful_proposals) +
                        parseInt(lastEpochData.performance[index].failed_proposals),
                    epoch: lastEpochData.epoch
                }));

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
                const currentPerformances = validators.map((validator, index) => ({
                    validator_address: validator.addr,
                    voting_power: validator.voting_power,
                    successful_proposals: parseInt(performance[index].successful_proposals),
                    total_proposals: parseInt(performance[index].successful_proposals) +
                        parseInt(performance[index].failed_proposals),
                    epoch: currentEpoch
                }));

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