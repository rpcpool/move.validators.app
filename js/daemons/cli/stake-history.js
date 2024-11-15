const {createClient} = require("redis");
const StakeHistory = require("../stake-history");

(async () => {

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/1";
    console.log(new Date(), " Start using redis url: ", redisUrl);
    const redisClient = await createClient({url: redisUrl})
        .on('error', err => console.log('Redis Client Error', err))
        .connect();

    // Run once
    const stakeHistory = await StakeHistory.create(redisClient);
    stakeHistory.run()
        .then(() => {
            console.log("StakeHistory processing complete");
            process.exit(0);
        })
        .catch(error => {
            console.error("Error:", error);
            process.exit(1);
        });

})();

// to run: node daemons/cli/stake-history.js