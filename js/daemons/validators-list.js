const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const BaseDaemon = require("./base-daemon");
const path = require('path');
const dotenvenc = require('@tka85/dotenvenc');

/**
 * The validators list is responsible for fetching the 'general' validator info on-chain.
 * This includes the validator's address, voting power, consensus public key, fullnode addresses,
 * network addresses, decoded network address, and validator index only.
 * Additional detailed data such as the epoch performance is fetched and computed separately.
 * Once the data is fetched, it is scrubbed/verified and then dropped on the queue to be processed
 * on the Rails side.
 */

class ValidatorsList extends BaseDaemon {
    // Default seconds is 300 - 5m
    constructor(redisUrlOrClient, seconds = 300) {
        super(redisUrlOrClient);
        this.seconds = seconds;
        this.interval = undefined;
        this.cache = {};
    }

    start() {
        // Call async initialize method
        this.initialize().then(() => {

            if (this.interval) {
                clearInterval(this.interval);
            }

            this.interval = setInterval(() => {
                this.run().then();
            }, this.seconds * 1000);

            // run immediately
            this.run().then();

            this.log("ValidatorsList started");

        }).catch(err => {
            console.error("Failed to initialize ValidatorsList:", err);
        });
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.log("ValidatorsList stopped");
    }

    async run() {
        this.log("ValidatorsList run started");

        try {

            const resources = await this.aptos.account.getAccountResources({
                accountAddress: "0x1",
            });

            const validatorSetResource = resources.find(
                (resource) => resource.type === "0x1::stake::ValidatorSet",
            );

            if (validatorSetResource) {
                const validators = validatorSetResource.data.active_validators;

                for (const [index, validator] of validators.entries()) {
                    const data = {};

                    this.log(`Starting data for: ${validator.addr}`)

                    data.index = index + 1;
                    data.validatorIndex = validator.config.validator_index;
                    data.address = validator.addr;
                    data.votingPower = validator.voting_power;
                    data.consensusPublicKey = validator.config.consensus_pubkey;
                    data.fullnodeAddress = validator.config.fullnode_addresses;
                    data.networkAddress = validator.config.network_addresses;

                    // Fetch additional details or staking address
                    const stakingResources = await this.aptos.account.getAccountResources({
                        accountAddress: validator.addr,
                    });

                    // See if we can find the staking address
                    const stakingResource = stakingResources.find(
                        (resource) => resource.type === "0x1::stake::StakingConfig",
                    );
                    if (stakingResource) {
                        data.stakingAddress = stakingResource.data.staking_address;
                    }

                    // Tease out any kind of domain name, if available
                    data.domain = this.decodeNetworkAddress(data.networkAddress);

                    // Check if data has changed
                    if (!this.cache[validator.addr] || JSON.stringify(this.cache[validator.addr]) !== JSON.stringify(data)) {
                        await this.jobDispatcher.enqueue("ValidatorJob", data);
                        this.cache[validator.addr] = data; // Update cache
                        this.log(`Data updated and enqueued for: ${validator.addr}`);
                    } else {
                        this.log(`No changes for: ${validator.addr}`);
                    }

                    this.log(`Finished data for: ${validator.addr}`);
                }
            } else {
                console.log("ValidatorSet resource not found.");
            }

        } catch (error) {
            this.log("Error fetching validators list");
            this.log(error);
        }

        this.log("ValidatorsList run complete");
    }

    decodeNetworkAddress(encodedAddress) {
        const hexString = encodedAddress.startsWith("0x")
            ? encodedAddress.slice(2)
            : encodedAddress;
        let asciiString = "";

        for (let i = 0; i < hexString.length; i += 2) {
            const hexPair = hexString.slice(i, i + 2);
            const charCode = parseInt(hexPair, 16);
            if (charCode >= 32 && charCode <= 126) {
                // Printable ASCII range
                asciiString += String.fromCharCode(charCode);
            }
        }

        // Extract potential domain names
        const domainPattern = /([a-z0-9-]+\.[a-z0-9-]+(?:\.[a-z]{2,})+)/gi;
        const domains = asciiString.match(domainPattern);

        if (domains) {
            // Further clean up: ensure each domain part is valid
            return domains
                .map((domain) => {
                    // Remove any leading or trailing non-domain characters
                    domain = domain.replace(/^[^a-z0-9-]+|[^a-z0-9-]+$/gi, "");

                    // Split the domain into parts and validate each part
                    const parts = domain.split(".");
                    const validParts = parts.every((part) => /^[a-z0-9-]+$/.test(part));

                    if (validParts) {
                        // Further clean up to ensure no invalid characters remain
                        return domain.replace(/[^a-z0-9-.]/gi, "");
                    }
                    return null;
                })
                .filter(Boolean)
                .join(", ");
        }

    }

}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const env = process.env.NODE_ENV || 'development';
    const encryptedFilePath = path.resolve(process.cwd(), `.env.${env}.enc`);

    dotenvenc.decrypt({encryptedFile: encryptedFilePath})
        .then(() => {
            const redisUrl = process.env.REDIS_URL;
            new ValidatorsList(redisUrl).start();
        });
} else {
    console.log(new Date(), "ValidatorsList detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorsList;
