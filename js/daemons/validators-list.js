const dns = require('node:dns');
const util = require('node:util');
const geoIp = require('geoip2-api');
const lookup = require('country-code-lookup');
const BaseDaemon = require("./base-daemon");
const AptosCliWrapper = require("../lib/console/aptos-cli-wrapper");
const {isIpAddress, extractDomain, padClassName} = require("../lib/utils");

const dnsLookupPromise = util.promisify(dns.lookup);
const dnsReversePromise = util.promisify(dns.reverse);

const railsJob = "ValidatorJob";

/**
 * The validators list is responsible for fetching the 'general' validator info on-chain.
 * This includes the validator's address, voting power, consensus public key, fullnode addresses,
 * network addresses, decoded network address, and validator index only.
 * Additional detailed data such as the epoch performance is fetched and computed separately.
 * Once the data is fetched, it is scrubbed/verified and then dropped on the queue.rake to be processed
 * on the Rails side.
 */
class ValidatorsList extends BaseDaemon {
    constructor(redisClient, jobDispatcher, aptos) {
        super(redisClient, jobDispatcher, aptos);
        this.running = false;
        this.seconds = 900; // 15 mins
        this.interval = undefined;
        this.cache = {};
        this.aptosCliWrapper = new AptosCliWrapper();
        this.network = aptos.config.network;

        // Allow test mocks to override these
        this.dnsLookupPromise = dnsLookupPromise;
        this.dnsReversePromise = dnsReversePromise;
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

        this.log('ValidatorsList daemon started');
    }

    /**
     * Stop the daemon
     */
    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.running = false;
        this.log('ValidatorsList daemon stopping');
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
        this.log("ValidatorsList run started");

        try {
            const validators = await this.fetchValidatorSet();
            if (!validators) {
                this.log("No validators found");
                return;
            }

            this.log(`Processing ${validators.length} validators`);
            
            // Process each validator
            for (let i = 0; i < validators.length; i++) {
                await this.processValidator(validators[i], i);
            }

            this.log("ValidatorsList run complete");
        } catch (error) {
            this.log(`Error in ValidatorsList run: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
        } finally {
            this.running = false;
        }
    }

    /**
     * Process a single validator and enqueue job if changes detected
     */
    async processValidator(validator, index) {
        try {
            const data = {
                index: index + 1,
                validatorIndex: validator.config.validator_index,
                address: validator.addr,
                operator_address: null,
                votingPower: validator.voting_power || "0",
                consensusPublicKey: validator.config.consensus_pubkey || "",
                fullnodeAddress: validator.config.fullnode_addresses || "",
                networkAddress: validator.config.network_addresses || "",
                name: "Private/Unknown",
                host: "Private/Unknown",
                merged: {
                    data: {
                        stake_pool_active_value: "0",
                        coin_store_value: "0"
                    }
                }
            };

            this.log(`Processing validator: ${validator.addr}`);

            // Use aptosCliWrapper for stake pool details
            const payload = this.getStakePoolDetails(validator.addr);
            if (!payload.error) {
                const stakePoolDetails = payload.Result[0];

                if (stakePoolDetails?.pool_address) {
                    data.operator_address = `0x${stakePoolDetails.operator_address}`;
                    this.log(`Found operator address: ${data.operator_address}`);
                }

                const host = this.extractNetworkHost(stakePoolDetails);

                if (host !== "Unknown") {
                    try {
                        if (!isIpAddress(host)) {
                            const response = await this.dnsLookupPromise(host);
                            data.ip = response.address;
                            data.host = host;
                            data.name = extractDomain(host);

                            // Try reverse lookup on the IP
                            try {
                                const reverseResponse = await this.dnsReversePromise(response.address);
                                if (reverseResponse && reverseResponse[0]) {
                                    data.host = reverseResponse[0];
                                    data.name = extractDomain(reverseResponse[0]);
                                }
                            } catch (error) {
                                this.log(`Reverse lookup error: ${error.message}`);
                                if (error.stack) {
                                    this.log(`Stack trace: ${error.stack}`);
                                }
                                throw error;
                            }
                        } else {
                            data.ip = host;
                            try {
                                const reverseResponse = await this.dnsReversePromise(host);
                                if (reverseResponse && reverseResponse[0]) {
                                    data.host = reverseResponse[0];
                                    data.name = extractDomain(reverseResponse[0]);
                                }
                            } catch (error) {
                                this.log(`Reverse lookup error: ${error.message}`);
                                if (error.stack) {
                                    this.log(`Stack trace: ${error.stack}`);
                                }
                                throw error;
                            }
                        }

                        if (data.ip) {
                            try {
                                const ipData = await geoIp.get(data.ip);
                                if (ipData.success) {
                                    const country = lookup.byIso(ipData.data.country);
                                    data.ip_data = {
                                        country_code: country.internet,
                                        country: country.country,
                                        city: ipData.data.city,
                                        region: ipData.data.region,
                                        timezone: ipData.data.timezone,
                                        lat: ipData.data.ll[0].toString(),
                                        lng: ipData.data.ll[1].toString()
                                    };
                                }
                            } catch (error) {
                                this.log(`Error fetching IP data: ${error.message}`);
                                if (error.stack) {
                                    this.log(`Stack trace: ${error.stack}`);
                                }
                                throw error;
                            }
                        }
                    } catch (error) {
                        this.log(`DNS resolution error: ${error.message}`);
                        if (error.stack) {
                            this.log(`Stack trace: ${error.stack}`);
                        }
                        data.host = "Private/Unknown";
                        data.name = "Private/Unknown";
                    }
                }
            }

            data.start_date = await this.getEpochTimestamp(validator.addr);

            const resources = await this.getAccountResources(validator.addr, data);
            if (resources) {
                const hasChanges = this.hasSignificantChanges(this.cache[validator.addr], resources);
                if (hasChanges) {
                    await this.jobDispatcher.enqueue(railsJob, resources);
                    this.cache[validator.addr] = resources;
                    this.log(`Enqueued validator job - Address: ${validator.addr}, Stake Pool: ${resources.operator_address || 'unknown'}`);
                } else {
                    this.log(`No significant changes for validator: ${validator.addr}`);
                }
            }
        } catch (error) {
            this.log(`Error processing validator ${validator.addr}: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }

    async fetchValidatorSet() {
        const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/0x1/resource/0x1::stake::ValidatorSet`;
        try {
            const response = await this.fetchWithQueue(url);
            return response.data.active_validators;
        } catch (error) {
            this.log(`Error fetching validator set: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }

    async fetchAccountResources(address) {
        const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/${address}/resources`;
        try {
            return await this.fetchWithQueue(url);
        } catch (error) {
            this.log(`Error fetching account resources for ${address}: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }

    hasSignificantChanges(oldData, newData) {
        if (!oldData) return true;

        const significantFields = [
            'votingPower',
            'consensusPublicKey',
            'fullnodeAddress',
            'networkAddress',
            'validatorIndex',
            'operator_address',
            'name',
            ['merged', 'data', 'stake_pool_active_value'],
            ['merged', 'data', 'coin_store_value']
        ];

        return significantFields.some(field => {
            if (Array.isArray(field)) {
                return field.reduce((obj, key) => obj?.[key], oldData) !==
                    field.reduce((obj, key) => obj?.[key], newData);
            }
            return oldData[field] !== newData[field];
        });
    }

    getStakePoolDetails(address) {
        return this.aptosCliWrapper.execute('getStakePool', {
            ownerAddress: address,
            url: `https://fullnode.${this.network}.aptoslabs.com`
        });
    }

    extractNetworkHost(stakePoolDetails) {
        try {
            this.log(`Processing stake pool details: ${JSON.stringify(stakePoolDetails)}`);

            if (!stakePoolDetails?.validator_network_addresses?.[0]) {
                this.log(`No validator network addresses found`);
                return "Unknown";
            }
            const data = stakePoolDetails.validator_network_addresses[0];
            const host = data.split('/')[2];
            this.log(`Extracted host: ${host}`);
            return host;
        } catch (error) {
            this.log(`Error extracting network host: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            return "Unknown";
        }
    }

    async getEpochTimestamp(address) {
        function convertToDate(microseconds) {
            const milliseconds = parseInt(microseconds) / 1000;
            const date = new Date(milliseconds);
            return date.toISOString();
        }

        try {
            const url = `https://api.${this.network}.aptoslabs.com/v1/accounts/${address}/events/0x1::stake::StakePool/add_stake_events`;
            const stakeEvents = await this.fetchWithQueue(url);

            const version = stakeEvents?.[0]?.version;
            if (version) {
                const blockUrl = `https://api.${this.network}.aptoslabs.com/v1/blocks/by_version/${version}`;
                const block = await this.fetchWithQueue(blockUrl);

                const timestamp = block?.block_timestamp;
                if (timestamp) return convertToDate(timestamp);
            }
            return new Date().toISOString(); // Fallback to current time
        } catch (error) {
            this.log(`Error fetching epoch timestamp: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }

    async getAccountResources(address, data) {
        try {
            const resources = await this.fetchAccountResources(address);
            if (!resources) {
                return data;
            }

            const stakePool = resources.find(r => r.type === "0x1::stake::StakePool")?.data;
            const coinStore = resources.find(r => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>")?.data;

            if (stakePool?.active?.value) {
                data.merged.data.stake_pool_active_value = stakePool.active.value;
            }
            if (coinStore?.coin?.value) {
                data.merged.data.coin_store_value = coinStore.coin.value;
            }

            this.log(`Resources fetched for ${address} - Balance: ${data.merged.data.coin_store_value}, Stake: ${data.merged.data.stake_pool_active_value}`);
            return data;
        } catch (error) {
            this.log(`Error fetching resources for ${address}: ${error.message}`);
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`);
            }
            throw error;
        }
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), padClassName('ValidatorsList'), "service starting using redis url: ", redisUrl);

    ValidatorsList.create(redisUrl).then(() => {
        console.log(new Date(), padClassName('ValidatorsList'), "service start complete.");
    });
} else {
    console.log(new Date(), padClassName('ValidatorsList'), "detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorsList;
