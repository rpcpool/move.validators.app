const BaseDaemon = require("./base-daemon");
const {padClassName} = require('../lib/utils');

class ValidatorVotes extends BaseDaemon {
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

        this.log('ValidatorVotes daemon started');
    }

    /**
     * Stop the daemon
     */
    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.running = false;
        this.log('ValidatorVotes daemon stopping');
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
        this.log("ValidatorVotes run started");

        try {
            // Get current epoch first
            const currentEpoch = await this.getCurrentEpoch();

            // Get active validators
            const activeAddresses = await this.fetchActiveValidators();
            if (activeAddresses.length === 0) {
                this.log("No active validators found");
                return;
            }
            this.log(`Processing ${activeAddresses.length} active validators`);

            // Get all historical proposals
            const proposals = await this.fetchAllProposals(activeAddresses);
            if (proposals.length === 0) {
                this.log("No proposals found");
                return;
            }
            this.log(`Processing ${proposals.length} proposals`);

            // Process each proposal
            for (const proposal of proposals) {
                try {
                    const votingData = await this.processProposal(proposal, activeAddresses, currentEpoch);
                    if (votingData) {
                        await this.jobDispatcher.enqueue("ValidatorVotesJob", votingData);
                        this.log(`Enqueued voting data for proposal ${votingData.proposal_id}`);
                    }
                } catch (error) {
                    this.log(`Error processing proposal ${proposal}: ${error.message}`);
                    if (error.stack) {
                        this.log(`Stack trace: ${error.stack}`);
                    }
                }
            }

            this.log("ValidatorVotes run complete");
        } catch (error) {
            this.log(`Error in ValidatorVotes run: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
        } finally {
            this.running = false;
        }
    }

    /**
     * Fetch current epoch from ledger info
     */
    async getCurrentEpoch() {
        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/`;
            const response = await this.fetchWithQueue(url);
            this.log(`Got ledger info: chain_id=${response.chain_id}, epoch=${response.epoch}`);
            return response.epoch;
        } catch (error) {
            this.log(`Error getting current epoch: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return "0";
        }
    }

    /**
     * Fetch list of active validators
     */
    async fetchActiveValidators() {
        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resources`;
            const resources = await this.fetchWithQueue(url);

            const validatorSet = resources.find(r => r.type === "0x1::stake::ValidatorSet");
            if (!validatorSet) {
                this.log('No ValidatorSet resources found');
                return [];
            }

            const activeValidators = validatorSet.data.active_validators.map(v => v.addr);
            this.log(`Found ${activeValidators.length} active validators`);
            return activeValidators;
        } catch (error) {
            this.log(`Error fetching active validators: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return [];
        }
    }

    /**
     * Fetch all proposals with votes from active validators
     */
    async fetchAllProposals(activeAddresses) {
        try {
            let allVotes = [];
            let start = 0;
            const limit = 100;
            let seenProposals = new Set();

            while (true) {
                const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/events/0x1::aptos_governance::GovernanceEvents/vote_events?start=${start}&limit=${limit}`;
                const votes = await this.fetchWithQueue(url);

                if (votes.length === 0) break;

                for (const vote of votes) {
                    if (activeAddresses.includes(vote.data.voter)) {
                        seenProposals.add(vote.data.proposal_id.toString());
                        allVotes.push(vote);
                    }
                }

                this.log(`Fetched ${votes.length} votes, found ${allVotes.length} from active validators`);

                if (votes.length < limit) break;
                start += votes.length;
            }

            const proposals = [...seenProposals];
            this.log(`Found ${proposals.length} unique proposals from ${allVotes.length} total votes`);
            return proposals;
        } catch (error) {
            this.log(`Error fetching proposals: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return [];
        }
    }

    /**
     * Get voting events for a specific proposal
     */
    async getVotingEvents(proposalId) {
        try {
            let allEvents = [];
            let start = 0;
            const limit = 100;
            let seenVoters = new Set();

            while (true) {
                const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/events/0x1::aptos_governance::GovernanceEvents/vote_events?start=${start}&limit=${limit}`;
                const events = await this.fetchWithQueue(url);

                if (events.length === 0) break;

                for (const event of events) {
                    const eventProposalId = event.data.proposal_id.toString();
                    const targetProposalId = proposalId.toString();
                    
                    if (eventProposalId === targetProposalId) {
                        const voter = event.data.voter;
                        if (!seenVoters.has(voter)) {
                            seenVoters.add(voter);
                            allEvents.push(event);
                            this.log(`Found first vote from validator ${voter} for proposal ${proposalId}`);
                        }
                    }
                }

                this.log(`Processed ${events.length} events, found ${seenVoters.size} unique voters for proposal ${proposalId}`);

                if (events.length < limit) break;
                start += events.length;
            }

            return allEvents;
        } catch (error) {
            this.log(`Error fetching voting events for proposal ${proposalId}: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return [];
        }
    }

    /**
     * Process a single proposal's voting data
     */
    async processProposal(proposalId, activeValidators, epoch) {
        try {
            const votingEvents = await this.getVotingEvents(proposalId);
            this.log(`Processing ${votingEvents.length} unique voting events for proposal ${proposalId}`);

            // Create a map of validator addresses to their vote status
            const validatorVotes = new Map();
            
            for (const event of votingEvents) {
                const voter = event.data.voter;
                if (activeValidators.includes(voter)) {
                    validatorVotes.set(voter, 'participated');
                    this.log(`Recorded participation for validator ${voter} on proposal ${proposalId}`);
                }
            }

            // Create vote records for active validators
            const votes = activeValidators.map(validator => ({
                validator_address: validator,
                status: validatorVotes.has(validator) ? 'participated' : 'missed'
            }));

            // Log participation stats
            const participated = votes.filter(v => v.status === 'participated').length;
            this.log(`Proposal ${proposalId}: ${participated}/${activeValidators.length} validators participated`);

            return {
                proposal_id: proposalId,
                epoch: epoch,
                recorded_at: new Date().toISOString(),
                votes: votes
            };
        } catch (error) {
            this.log(`Error processing proposal ${proposalId}: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return null;
        }
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName('ValidatorVotes'), "service starting using redis url: ", redisUrl);

    ValidatorVotes.create(redisUrl).then(() => {
        console.log(new Date(), padClassName('ValidatorVotes'), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName('ValidatorVotes'), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorVotes;
