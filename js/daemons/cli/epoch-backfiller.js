const {createClient} = require("redis");
const EpochBackfiller = require("../epoch-backfiller");

(async () => {
    // Get epoch from command line arguments
    const targetEpoch = process.argv[2] ? parseInt(process.argv[2]) : null;
    if (!targetEpoch) {
        console.error("Usage: node epoch-backfiller.js <epoch_number>");
        process.exit(1);
    }

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/1";
    console.log(new Date(), " Using redis url:", redisUrl);
    const redisClient = await createClient({url: redisUrl})
        .on('error', err => console.log('Redis Client Error', err))
        .connect();

    // Run once with the specified epoch
    const epochBackfiller = await EpochBackfiller.create(redisClient);
    epochBackfiller.analyzeBackfillJob(targetEpoch)  // Pass the targetEpoch here
        .then(() => {
            console.log("EpochBackfiller processing complete");
            process.exit(0);
        })
        .catch(error => {
            console.error("Error:", error);
            process.exit(1);
        });

})();

// to run: node daemons/cli/epoch-backfiller.js 19534