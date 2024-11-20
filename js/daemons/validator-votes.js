const BaseDaemon = require("./base-daemon");

class ValidatorVotes extends BaseDaemon {
    constructor(redisClient, pubSubClient, jobDispatcher, aptos) {
        super(redisClient, pubSubClient, jobDispatcher, aptos);
        this.seconds = 900; // 15 minutes - adjust as needed
        this.interval = undefined;
        this.lastProcessedProposal = 0;
        this.network = aptos.config.network;
    }

    async fetchActiveValidators() {
        this.log(' fetchActiveValidators..');
        try {
            const resources = await this.aptos.account.getAccountResources({
                accountAddress: "0x1",
            });
            // this.log(`resources: ${JSON.stringify(resources.length)}`);

            const validatorSetResource = resources.find(
                (resource) => resource.type === "0x1::stake::ValidatorSet",
            );

            // this.log(`validatorSetResource: ${JSON.stringify(validatorSetResource)}`);

            if (validatorSetResource) {
                const validators = validatorSetResource.data.active_validators;
                return validators.map(v => v.addr);
            }
            this.log('No ValidatorSet resources..');
            return [];

        } catch (error) {
            this.log(`Error fetching active validators on ${this.aptos.config.network}: ${error.message}`);
            return [];
        }
    }

    async fetchProposals() {
        try {
            // Get governance proposals
            const governance = await this.aptos.account.getAccountResource(
                "0x1",
                "0x1::aptos_governance::GovernanceResponsibility"
            );

            const proposals = governance.data.proposals || [];
            return proposals.filter(p => parseInt(p.proposal_id) > this.lastProcessedProposal);
        } catch (error) {
            this.log(`Error fetching proposals: ${error.message}`);
            return [];
        }
    }

    async fetchRecentProposals(activeAddresses) {
        try {
            // Get all proposal events from the framework account
            const url = `https://api.${this.aptos.config.network}.aptoslabs.com/v1/accounts/0x1/events/0x1::aptos_governance::GovernanceEvents/vote_events`;
            const votes = await this.fetchWithDelay(url, this.rateLimit);

            // Filter for votes from our active validators
            const validatorVotes = votes.filter(vote =>
                activeAddresses.includes(vote.data.voter)
            );

            this.log(`Found ${validatorVotes.length} total votes from active validators`);

            // Get unique proposal IDs
            const proposals = [...new Set(validatorVotes.map(vote => vote.data.proposal_id))];
            this.log(`Found ${proposals.length} unique proposals`);

            return proposals;
        } catch (error) {
            this.log(`Error fetching proposals: ${error.message}`);
            return [];
        }
    }

    async getVotingEvents(proposalId) {
        try {
            let allEvents = [];
            let start = 0;
            const limit = 100;

            while (true) {
                const url = `https://api.${this.aptos.config.network}.aptoslabs.com/v1/accounts/0x1/events/0x1::aptos_governance::GovernanceEvents/vote_events?start=${start}&limit=${limit}`;
                const events = await this.fetchWithDelay(url, this.rateLimit);

                if (events.length === 0) break;

                allEvents = allEvents.concat(events);
                start += events.length;

                this.log(`Fetched ${events.length} vote events, total so far: ${allEvents.length}`);

                if (events.length < limit) break;
            }

            return allEvents;
        } catch (error) {
            this.log(`Error fetching voting events: ${error.message}`);
            return [];
        }
    }

    async processProposal(proposalId, activeValidators, epoch) {
        try {
            const votingEvents = await this.getVotingEvents(proposalId);

            const proposalVotes = votingEvents.filter(event =>
                event.data.proposal_id === proposalId
            );

            const votedValidators = new Set(proposalVotes.map(event => event.data.voter));
            this.log(`Found ${votedValidators.size} votes for proposal ${proposalId}`);

            const votes = activeValidators.map(validator => ({
                validator_address: validator,
                status: votedValidators.has(validator) ? 'participated' : 'missed'
            }));

            return {
                proposal_id: proposalId,
                epoch: epoch,
                recorded_at: new Date().toISOString(),
                votes: votes
            };
        } catch (error) {
            this.log(`Error processing proposal ${proposalId}: ${error.message}`);
            return null;
        }
    }

    async getCurrentEpoch() {
        try {
            const url = `https://api.${this.aptos.config.network}.aptoslabs.com/v1/`;
            const response = await this.fetchWithDelay(url, this.rateLimit);
            this.log(`Got ledger info: chain_id=${response.chain_id}, epoch=${response.epoch}`);
            return response.epoch;
        } catch (error) {
            this.log(`Error getting current epoch: ${error.message}`);
            return "0";
        }
    }

    async run() {
        this.running = true;

        this.log("ValidatorVotes run started");

        try {
            // Get current epoch first
            const currentEpoch = await this.getCurrentEpoch();
            // this.log(`Current epoch: ${currentEpoch}`);

            // Get active validators
            const activeAddresses = await this.fetchActiveValidators();
            if (activeAddresses.length === 0) {
                this.log("No active validators found");
                return;
            } else {
                this.log(`Got ${activeAddresses.length} validators`);
            }

            // Get recent proposals
            const proposals = await this.fetchRecentProposals(activeAddresses);
            if (proposals.length === 0) {
                this.log("No proposals found");
                return;
            }

            // Process each proposal using the already fetched epoch
            for (const proposal of proposals) {
                const votingData = await this.processProposal(proposal, activeAddresses, currentEpoch);
                // console.log(JSON.stringify(votingData));
                if (votingData) {
                    await this.jobDispatcher.enqueue("ValidatorVotesJob", votingData);
                    this.log(`Enqueued historical voting data for proposal ${votingData.proposal_id}`);
                }
            }
            this.log("ValidatorVotes fetch complete");

        } catch (error) {
            this.log(`Error in ValidatorVotes run: ${error.message}`);
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

        this.log("ValidatorVotes started");
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log("ValidatorVotes stopped");
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    new ValidatorVotes(redisUrl);
} else {
    console.log(new Date(), "ValidatorVotes detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorVotes;