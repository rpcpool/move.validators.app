const BaseDaemon = require("../base-daemon");
const {createClient} = require("redis");
const ValidatorVotes = require("../validator-votes");

(async () => {

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/1";
    console.log(new Date(), " DevDaemons start using redis url: ", redisUrl);
    const redisClient = await createClient({url: redisUrl})
        .on('error', err => console.log('Redis Client Error', err))
        .connect();

    // Run once
    const validatorVotes = await ValidatorVotes.create(redisClient);
    validatorVotes.run()
        .then(() => {
            console.log("Historical votes processing complete");
            process.exit(0);
        })
        .catch(error => {
            console.error("Error:", error);
            process.exit(1);
        });

})();

// to run: node daemons/cli/historical-votes.js