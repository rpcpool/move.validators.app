const BaseDaemon = require("./base-daemon");

class StakeHistory extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.seconds = 2600; // Run every hour
        this.interval = undefined;
        this.network = aptos.config.network;
        this.lastProcessedVersion = '0';
    }

    async fetchValidatorStakePool(validatorAddr) {
        const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/${validatorAddr}/resource/0x1::stake::StakePool`;
        try {
            const response = await this.fetchWithDelay(url, this.rateLimit);
            // console.log("fetchValidatorStakePool:", response);
            return response.data;
        } catch (error) {
            this.log(`Error fetching stake pool for ${validatorAddr}: ${error.message}`);
            return null;
        }
    }

    async fetchBulkStakeEvents(startVersion = '0', limit = 100) {
        try {
            const {active, pending} = await this.fetchActiveValidators();
            const validators = [...active, ...pending];
            this.log(`Processing ${validators.length} validators`);

            const allEvents = [];

            const eventTypes = [
                'add_stake_event',
                'withdraw_stake_event',
                'join_validator_set_event',
                'leave_validator_set_event'
            ];

            for (const validator of validators) {
                this.log(`Fetching events for validator ${validator.addr}`);
                const stakePool = await this.fetchValidatorStakePool(validator.addr);

                if (!stakePool) {
                    this.log(`No stake pool found for validator ${validator.addr}`);
                    continue;
                }

                // Fetch all event types for this validator
                for (const eventType of eventTypes) {
                    const creationNum = stakePool[`${eventType}s`]?.guid?.id?.creation_num;
                    if (!creationNum) {
                        this.log(`No ${eventType} creation number found for validator ${validator.addr}`);
                        continue;
                    }

                    const events = await this.fetchValidatorEvents(
                        validator.addr,
                        eventType,
                        creationNum,
                        startVersion,
                        limit
                    );

                    this.log(`Found ${events.length} ${eventType} events for validator ${validator.addr}`);
                    if (events.length > 0) {
                        allEvents.push(...events);
                    }
                }
            }

            // Sort events by version using string comparison instead of BigInt
            const sortedEvents = allEvents.sort((a, b) => {
                // Convert to BigInt for comparison but don't try to convert back to number
                return BigInt(a.version) > BigInt(b.version) ? 1 : -1;
            });

            this.log(`Total events found: ${sortedEvents.length}`);
            return sortedEvents;

        } catch (error) {
            this.log(`Error fetching bulk stake events: ${error.message}`);
            return [];
        }
    }

    async fetchValidatorEvents(validatorAddr, eventType, creationNum, startVersion = '0', limit = 100) {
        const events = [];
        let hasMore = true;
        let start = startVersion;

        while (hasMore) {
            try {
                const eventHandlePaths = {
                    add_stake_event: '0x1::stake::StakePool/add_stake_events',
                    withdraw_stake_event: '0x1::stake::StakePool/withdraw_stake_events',
                    join_validator_set_event: '0x1::stake::StakePool/join_validator_set_events',
                    leave_validator_set_event: '0x1::stake::StakePool/leave_validator_set_events'
                };

                const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/${validatorAddr}/events/${eventHandlePaths[eventType]}`;

                const response = await this.fetchWithDelay(`${url}?start=${start}&limit=${limit}`, this.rateLimit);
                this.log(`Fetched ${response.length} ${eventType} events for ${validatorAddr} starting at ${start}`);

                if (response.length > 0) {
                    events.push(...response.map(event => ({
                        ...event,
                        event_type: eventType,
                        validator_address: validatorAddr
                    })));

                    // Get the next starting point from the last event
                    const lastEvent = response[response.length - 1];
                    start = lastEvent.sequence_number;

                    // If we got less than the limit, we've reached the end
                    hasMore = response.length === limit;
                } else {
                    hasMore = false;
                }

                // Add a small delay between pages to respect rate limits
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 1000 / this.rateLimit));
                }

            } catch (error) {
                this.log(`Error fetching ${eventType} for ${validatorAddr}: ${error.message}`);
                hasMore = false;
            }
        }

        return events;
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

    async processValidatorEvents(validator) {
        const stakePool = await this.fetchValidatorStakePool(validator.addr);
        if (!stakePool) return [];

        const events = [];
        const eventTypes = [
            'add_stake_event',
            'withdraw_stake_event',
            'join_validator_set_event',
            'leave_validator_set_event'
        ];

        for (const eventType of eventTypes) {
            const creationNum = stakePool[`${eventType}s`]?.guid?.id?.creation_num;
            if (!creationNum) continue;

            const validatorEvents = await this.fetchValidatorEvents(
                validator.addr,
                eventType,
                creationNum,
                this.lastProcessedVersion,
                100
            );

            if (validatorEvents.length > 0) {
                events.push(...validatorEvents);
            }
        }

        return events;
    }

    async run() {
        this.running = true;

        this.log("StakeHistory run started");

        try {
            const {active, pending} = await this.fetchActiveValidators();
            const validators = [...active, ...pending];

            this.log(`Processing ${validators.length} validators individually`);

            // Process one validator per job
            for (const validator of validators) {
                const validatorEvents = await this.processValidatorEvents(validator);

                if (validatorEvents.length > 0) {
                    await this.jobDispatcher.enqueue("StakeHistoryJob", {
                        events: {
                            [validator.addr]: validatorEvents
                        },
                        validator_address: validator.addr,
                        total_validators: validators.length
                    });
                    this.log(`Enqueued stake history job for validator ${validator.addr}`);
                }
            }

        } catch (error) {
            this.log(`Error in StakeHistory run: ${error.message}`);
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
    console.log(new Date(), "StakeHistory service starting using redis url: ", redisUrl);

    StakeHistory.create(redisUrl).then(() => {
        console.log(new Date(), "StakeHistory service start complete.");
    });
} else {
    console.log(new Date(), "StakeHistory detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = StakeHistory;