const {createClient} = require("redis");
const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const JobDispatcher = require("../../lib/queue/job-dispatcher");
const LedgerInfo = require("../ledger-info");

(async () => {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/1";
    console.log(new Date(), " DevDaemons start using redis url: ", redisUrl);
    
    // Set up Redis client
    const redisClient = await createClient({url: redisUrl})
        .on('error', err => console.log('Redis Client Error', err))
        .connect();

    // Set up job dispatcher
    const jobDispatcher = new JobDispatcher(redisClient);

    // Set up Aptos client
    const network = process.env.NODE_ENV === 'production' || process.env.APTOS_NETWORK === 'mainnet' 
        ? Network.MAINNET 
        : Network.TESTNET;
    const aptosConfig = new AptosConfig({network});
    const aptos = new Aptos(aptosConfig);

    // Create ledger info instance directly (not using create() to avoid auto-start)
    const ledgerInfo = new LedgerInfo(redisClient, jobDispatcher, aptos);
    await ledgerInfo.blockingClient.connect();
    await ledgerInfo.listenForResponses();

    // Run once
    await ledgerInfo.run()
        .then(() => {
            console.log("Ledger info processing complete");
            process.exit(0);
        })
        .catch(error => {
            console.error("Error:", error);
            process.exit(1);
        });
})();

// to run: node daemons/cli/ledger-info.js
