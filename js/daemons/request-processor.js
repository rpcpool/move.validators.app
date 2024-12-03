const BaseDaemon = require('./base-daemon');

class RequestProcessor extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.maxRequestsPerSecond = 10;
        this.running = false;
    }

    async run() {
        this.log('RequestProcessor run starting');
        let lastProcessTime = 0;  // Track last request time

        const processNextRequest = async () => {
            try {
                // Calculate time since last request
                const now = Date.now();
                const timeSinceLastRequest = now - lastProcessTime;
                const minRequestInterval = 1000 / this.maxRequestsPerSecond;

                // If we need to wait to maintain rate limit
                if (timeSinceLastRequest < minRequestInterval) {
                    await this.sleep(minRequestInterval - timeSinceLastRequest);
                }
                const result = await this.blockingClient.brPop('request_queue', 5);
                if (result) {
                    lastProcessTime = Date.now();  // Update last request time
                    const {element} = result;
                    const requestData = JSON.parse(element);

                    this.log(`RequestProcessor making fetch for url ${requestData.url}`);

                    const response = await fetch(requestData.url);
                    const responseBody = await response.text();
                    const data = responseBody ? JSON.parse(responseBody) : null;

                    await this.redisClient.lPush(requestData.responseQueue, JSON.stringify({
                        requestId: requestData.id,
                        status: response.status,
                        data: data,
                        body: responseBody
                    }));
                }
            } catch (error) {
                this.log(`Error processing request: ${error.message}`);
            }

            if (this.running) {
                setImmediate(processNextRequest);
            }
        };

        // Start the processing loop
        processNextRequest().then();
    }

    // Override to do nothing since RequestProcessor doesn't need to listen for responses
    async listenForResponses() {
        // do nothing
    }

    /**
     * Start the processor
     */
    async start() {
        this.running = true;
        this.log('Request processor started');
        this.run().then();
    }

    /**
     * Stop the processor
     */
    async stop() {
        this.running = false;
        this.log('Request processor stopping');
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), "RequestProcessor service starting using redis url: ", redisUrl);

    RequestProcessor.create(redisUrl).then(() => {
        console.log(new Date(), "RequestProcessor service start complete.");
    });
} else {
    console.log(new Date(), "RequestProcessor detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = RequestProcessor;