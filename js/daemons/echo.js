const BaseDaemon = require("./base-daemon");

// This is a test daemon that just receives a job from the front end and echos the data to the log.


class Echo extends BaseDaemon {
    constructor(redisClient, pubSubClient, jobDispatcher, aptos) {
        super(redisClient, pubSubClient, jobDispatcher, aptos);
        this.interval = undefined;
    }

    async run() {
        try {
            await this.jobDispatcher.listen("EchoRequest", (data) => {
                this.log("((( Received EchoRequest data: )))");
                this.log(JSON.stringify(data, null, 2));
            });
        } catch (error) {
            this.log(`Error in Echo: ${error.message}`);
        }
    }

    start() {
        this.run().then();
        this.log("Echo started");
    }

    stop() {
        if (this.jobDispatcher) {
            this.jobDispatcher.unsubscribe("EchoRequest");
        }
        this.log("Echo stopped");
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    new Echo(redisUrl);
} else {
    console.log(new Date(), "Echo detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = Echo;