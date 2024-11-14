const BaseDaemon = require("./base-daemon");

class StakeHistoryDaemon extends BaseDaemon {
    constructor(redisClient, pubSubClient, jobDispatcher, aptos) {
        super(redisClient, pubSubClient, jobDispatcher, aptos);
        this.seconds = 300; // Run every 5 minutes
        this.interval = undefined;
        this.network = aptos.config.network;
        this.rateLimit = 65;
        this.lastProcessedVersion = '0';
    }

    async fetchBulkStakeEvents(startVersion = '0', limit = 100) {
        const url = `https://api.${this.network}.aptoslabs.com/v1/events`;
        const eventHandles = [
            '0x1::stake::StakePool/add_stake_event',
            '0x1::stake::StakePool/withdraw_stake_event',
            '0x1::stake::StakePool/join_validator_set_event',
            '0x1::stake::StakePool/leave_validator_set_event'
        ];

        try {
            // Fetch events in parallel with pagination
            const events = await Promise.all(eventHandles.map(async handle => {
                const response = await this.fetchWithDelay(`${url}/${handle}?start=${startVersion}&limit=${limit}`, this.rateLimit);
                return response.map(event => ({
                    ...event,
                    event_type: handle.split('/')[1]
                }));
            }));

            // Combine and sort all events
            return events.flat().sort((a, b) => BigInt(a.version) - BigInt(b.version));
        } catch (error) {
            this.log(`Error fetching bulk stake events: ${error.message}`);
            return [];
        }
    }

    async fetchActiveValidators() {
        const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::stake::ValidatorSet`;
        try {
            const response = await this.fetchWithDelay(url, this.rateLimit);
            return {
                active: response.data.active_validators,
                pending: response.data.pending_active
            };
        } catch (error) {
            this.log(`Error fetching validator set: ${error.message}`);
            return {active: [], pending: []};
        }
    }

    async run() {
        this.log("StakeHistory run started");

        try {
            // 1. Get current validator set (single API call)
            const {active, pending} = await this.fetchActiveValidators();
            const validatorAddresses = [...active, ...pending].map(v => v.addr);

            // 2. Fetch bulk events since last processed version
            const events = await this.fetchBulkStakeEvents(this.lastProcessedVersion);

            if (events.length > 0) {
                // Group events by validator
                const eventsByValidator = events.reduce((acc, event) => {
                    const addr = event.data.pool_address;
                    acc[addr] = acc[addr] || [];
                    acc[addr].push(event);
                    return acc;
                }, {});

                // 3. Prepare data for processing
                const stakeData = {
                    events: eventsByValidator,
                    validator_set: {
                        active: active.map(v => ({
                            address: v.addr,
                            voting_power: v.voting_power,
                            config: v.config
                        })),
                        pending: pending.map(v => ({
                            address: v.addr,
                            config: v.config
                        }))
                    },
                    last_processed_version: events[events.length - 1]?.version || this.lastProcessedVersion,
                    fetched_at: new Date().toISOString()
                };

                // await this.jobDispatcher.enqueue("StakeHistoryJob", stakeData);
                this.log(`Enqueued stake events for ${Object.keys(eventsByValidator).length} validators`);

                // Update last processed version
                this.lastProcessedVersion = stakeData.last_processed_version;
            }

        } catch (error) {
            this.log(`Error in StakeHistory run: ${error.message}`);
        }
    }

    start() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        this.interval = setInterval(() => {
            this.run().then();
        }, this.seconds * 1000);

        // Run immediately
        this.run().then();

        this.log("StakeHistory started");
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log("StakeHistory stopped");
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    new StakeHistoryDaemon(redisUrl);
} else {
    console.log(new Date(), "StakeHistoryDaemon detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = StakeHistoryDaemon;