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
            // Init redis
            const redisUrl = process.env.REDIS_URL;
            console.log(new Date(), " DevDaemons start using redis url: ", redisUrl);
            const redisClient = await createClient({url: redisUrl})
                .on('error', err => console.log('Redis Client Error', err))
                .connect();


            // Echo - this is a dev service to test round-trip from rails -> node
            // const echo = await Echo.create(redisClient);
            // this.services.push(echo);

            // RequestProcessor - this is the service that provides the sync request queue
            const requestProcessor = await RequestProcessor.create(redisClient);
            this.services.push(requestProcessor);

            // Set up each daemon here for management
            // Each daemon is run via a local systemd service, so they need to be able to start themselves based on
            // instantiation.
            // Below we define the ones we want to run locally.

            // EpochJob
            const ledgerInfo = await LedgerInfo.create(redisClient);
            this.services.push(ledgerInfo);

            // ValidatorsList
            const validatorsList = await ValidatorsList.create(redisClient);
            this.services.push(validatorsList);

            // Block info
            const blockProposals = await BlockProposals.create(redisClient);
            this.services.push(blockProposals);

            // ValidatorRewards
            const validatorRewards = await ValidatorRewards.create(redisClient);
            this.services.push(validatorRewards);

            // EpochHistory
            // const epochHistory = await EpochHistory.create(redisClient);
            // this.services.push(epochHistory);

            // Transactions
            // const transactions = await Transactions.create(redisClient);
            // this.services.push(transactions);

            // ValidatorVotes
            const validatorVotes = await ValidatorVotes.create(redisClient);
            this.services.push(validatorVotes);

            // APT Price
            const aptPrice = await CoinGeckoPrices.create(redisClient);
            this.services.push(aptPrice);

            // BlockUpdateFetch
            const blockUpdateFetch = await BlockUpdateFetch.create(redisClient);
            this.services.push(blockUpdateFetch);

            // ValidatorPerformance
            const validatorPerformance = await ValidatorPerformance.create(redisClient);
            this.services.push(validatorPerformance);

        } catch (err) {
            console.error('Failed to start correctly:', err);
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
