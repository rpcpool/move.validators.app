const {createClient} = require("redis");
require('dotenv').config()
const RequestProcessor = require("../daemons/request-processor");
const ValidatorsList = require("../daemons/validators-list");
const EpochHistory = require("../daemons/epoch-history");
const Transactions = require("../daemons/transactions");
const ValidatorRewards = require("../daemons/validator-rewards");
const BlockProposals = require("../daemons/block-proposals");
const LedgerInfo = require("../daemons/ledger-info");
const ValidatorVotes = require("../daemons/validator-votes");
const CoinGeckoPrices = require("../daemons/coin-gecko-prices");
const BlockUpdateFetch = require("../daemons/block-update-fetch");
const ValidatorPerformance = require("../daemons/validator-performance");
const Echo = require("../daemons/echo");
const {padClassName} = require("./utils");
const RequestManager = require("../daemons/request-manager");
const StakeHistory = require("../daemons/stake-history");

/**
 * This class will bootstrap all/any of the daemons we want to run in development mode only. It is not meant to
 * be used in any other environment. It should be excluded from any deployable builds as well.
 * In the start() method, encrypted env vars are decrypted and add to the process.env, redis is bootstrapped and then
 * each daemon is started.
 */
class DevDaemons {
    constructor() {
        this.services = [];
    }

    async start() {
        try {
            // Check for required REDIS_URL
            if (!process.env.REDIS_URL) {
                console.error(new Date(), padClassName('DevDaemons'), "ERROR: REDIS_URL environment variable is not set");
                process.exit(1);
            }

            // Init redis
            const redisUrl = process.env.REDIS_URL;
            console.log(new Date(), padClassName('DevDaemons'), "start using redis url: ", redisUrl);
            const redisClient = await createClient({url: redisUrl})
                .on('error', err => console.log(new Date(), padClassName('DevDaemons'), 'Redis Client Error', err))
                .connect();

            // Echo - this is a dev service to test round-trip from rails -> node
            // const echo = await Echo.create(redisClient);
            // this.services.push(echo);

            // Start daemons with staggered delays to prevent API rate limit issues

            // RequestManager - starts immediately (no API calls)
            const requestManager = await RequestManager.create(redisClient);
            this.services.push(requestManager);

            // LedgerInfo - lightweight API calls
            const ledgerInfo = await LedgerInfo.create(redisClient);
            this.services.push(ledgerInfo);

            // ValidatorsList
            const validatorsList = await ValidatorsList.create(redisClient);
            this.services.push(validatorsList);

            // Block info
            const blockProposals = await BlockProposals.create(redisClient);
            this.services.push(blockProposals);

            // StakeHistory
            const stakeHistory = await StakeHistory.create(redisClient);
            this.services.push(stakeHistory);

            // ValidatorRewards
            const validatorRewards = await ValidatorRewards.create(redisClient);
            this.services.push(validatorRewards);

            // ValidatorVotes
            const validatorVotes = await ValidatorVotes.create(redisClient);
            this.services.push(validatorVotes);

            // APT Price - different API, can run in parallel with Aptos API calls
            const aptPrice = await CoinGeckoPrices.create(redisClient);
            this.services.push(aptPrice);

            // ValidatorPerformance
            const validatorPerformance = await ValidatorPerformance.create(redisClient);
            this.services.push(validatorPerformance);

            // EpochHistory
            const epochHistory = await EpochHistory.create(redisClient);
            this.services.push(epochHistory);

            // BlockUpdateFetch
            const blockUpdateFetch = await BlockUpdateFetch.create(redisClient);
            this.services.push(blockUpdateFetch);

            // Commented out services
            // Transactions
            // const transactions = await Transactions.create(redisClient);
            // this.services.push(transactions);

        } catch (err) {
            console.error(new Date(), padClassName('DevDaemons'), 'Failed to start correctly:', err);
            process.exit(1);
        }
    }

    // Currently we don't have a need to stop the services, but we add that stub here.
    async stop() {
        for (let daemon of this.services) {
            if (daemon && typeof daemon.start === 'function') await daemon.stop();
        }
    }
}

new DevDaemons().start().then();

module.exports = DevDaemons;
