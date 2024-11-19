const fs = require('fs');
const path = require('path');
const dns = require('node:dns');
const util = require('node:util');
const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const geoIp = require('geoip2-api');
const lookup = require('country-code-lookup');
const BaseDaemon = require("./base-daemon");
const AptosCliWrapper = require("../lib/console/aptos-cli-wrapper");
const {isIpAddress, extractDomain} = require("../lib/utils");

const dnsLookupPromise = util.promisify(dns.lookup);
const dnsReversePromise = util.promisify(dns.reverse);

/**
 * The validators list is responsible for fetching the 'general' validator info on-chain.
 * This includes the validator's address, voting power, consensus public key, fullnode addresses,
 * network addresses, decoded network address, and validator index only.
 * Additional detailed data such as the epoch performance is fetched and computed separately.
 * Once the data is fetched, it is scrubbed/verified and then dropped on the queue.rake to be processed
 * on the Rails side.
 */

class ValidatorsList extends BaseDaemon {
    // Default seconds is 300 - 5m
    constructor(redisClient, pubSubClient, jobDispatcher, aptos) {
        super(redisClient, pubSubClient, jobDispatcher, aptos);
        this.seconds = 300;
        this.interval = undefined;
        this.cache = {};
        this.aptosCliWrapper = new AptosCliWrapper();
        this.network = aptos.config.network;
    }

    start() {
        if (this.interval) {
            clearInterval(this.interval);
        }

        this.interval = setInterval(() => {
            this.run().then();
        }, this.seconds * 1000);

        // run immediately
        this.run().then();

        this.log("ValidatorsList started");
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

                    // There should only be one Result
                    const payload = this.getStakePoolDetails(validator.addr);
                    if (payload.error) {
                        this.log(`Error processing the stake pool details for ${validator.addr}, skipping.`);
                        this.log(payload.message);
                        continue;
                    }
                    const stakePoolDetails = payload.Result[0];

                    // Tease out any kind of domain name, if available
                    data.host = this.extractNetworkHost(stakePoolDetails);

                    let host = data.host;
                    if (!isIpAddress(host)) {
                        const response = await dnsLookupPromise(host);
                        data.ip = response.address;
                    } else {
                        try {
                            const response = await dnsReversePromise(data.host);
                            this.log(`reverse response: ${response}`);
                            data.host = response[0];
                        } catch (e) {
                            this.log(`Caught reverse lookup error: ${e.message}`);
                            data.host = 'Private/Unknown';
                        }
                    }

                    try {
                        const ipData = await geoIp.get(data.ip);
                        if (ipData.success) {
                            const country = lookup.byIso(ipData.data.country);
                            data.ip_data = {
                                country_code: country.internet,
                                country: country.country,
                                city: ipData.data.city,
                                region: ipData.data.region, // for US, it's a state
                                timezone: ipData.data.timezone,
                                lat: ipData.data.ll[0],
                                lng: ipData.data.ll[1],
                            };
                        }
                    } catch (e) {
                        // console.log("Caught get ip error:", e);
                        // continue;
                    }

                    // If we have a valid host, get the domain
                    if (data.host && data.host !== 'Private/Unknown' && data.host !== data.ip) {
                        data.name = extractDomain(data.host);
                    } else {
                        data.name = 'Private/Unknown';
                    }

                    data.start_date = await this.getEpochTimestamp(validator.addr);

                    // Check if data has changed
                    if (!this.cache[validator.addr] || JSON.stringify(this.cache[validator.addr]) !== JSON.stringify(data)) {
                        const finalData = await this.getAccountResources(validator.addr, data);
                        await this.jobDispatcher.enqueue("ValidatorJob", finalData);
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

    getStakePoolDetails(address) {
        return this.aptosCliWrapper.execute('getStakePool', {ownerAddress: address});
    }

    extractNetworkHost(stakePoolDetails) {
        // ...
        //       "validator_network_addresses": [
        //         "/dns/aptos-testnet-figment-dp-1.staking.production.figment.io/tcp/6180/noise-ik/0x57a5cd66f86cc022897bcf146917fcb3da2fd5c4dac7a3bfb4e75afd0416e839/handshake/0"
        //       ],
        //       "fullnode_network_addresses": [
        //         "/dns/aptos-testnet-figment-vfn-1.staking.production.figment.io/tcp/6182/noise-ik/0x87cd3dce1649d889d0f5909acc7208d9940ef485c41992cc42102c4d38a7386a/handshake/0"
        //       ],
        // ...

        try {
            if (!stakePoolDetails || !stakePoolDetails.validator_network_addresses || stakePoolDetails.validator_network_addresses.length === 0) {
                this.log(`No validator network addresses found`);
                return "Unknown";
            }
            const data = stakePoolDetails.validator_network_addresses[0];
            const host = data.split('/')[2];
            this.log(`Got host: ${host}`);
            return host;
        } catch (e) {
            console.error(e);
            return "Unknown";
        }
    }

    async getEpochTimestamp(address, network = "testnet") {
        function convertToDate(microseconds) {
            const milliseconds = parseInt(microseconds) / 1000; // Convert to milliseconds
            const date = new Date(milliseconds); // Convert to Date object
            return date.toISOString(); // Convert to ISO string format
        }

        let url;
        try {

            url = `https://api.${network}.aptoslabs.com/v1/accounts/${address}/events/0x1::stake::StakePool/add_stake_events`;
            let stakeEvents;
            try {
                const response = await fetch(url);
                stakeEvents = await response.json(); // Parsing the response body as JSON
            } catch (error) {
                console.error('Error fetching events:', error);
            }

            const version = stakeEvents?.[0]?.version;
            if (version) {
                url = `https://api.${network}.aptoslabs.com/v1/blocks/by_version/${version}`
                try {
                    const response = await fetch(url);
                    const block = await response.json();

                    const timestamp = block?.block_timestamp;
                    if (timestamp) return convertToDate(timestamp);
                } catch (error) {
                    console.error('Error fetching events:', error);
                }
            }

        } catch (error) {
            console.error(`Error:`, error);
        }
    }

    async getAccountResources(address, data) {
        try {
            // Fetch all resources for the validator
            const resources = await this.aptos.account.getAccountResources({
                accountAddress: address,
            });

            const stakePool = resources.find(r => r.type === "0x1::stake::StakePool")?.data;
            const coinStore = resources.find(r => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>")?.data;

            const coin_store_value = coinStore?.coin?.value || "0";
            const stake_pool_active_value = stakePool?.active?.value || "0";

            const processedData = {
                address: address,
                coin_store_value,
                stake_pool_active_value
            };

            data.merged = {
                data: processedData
            };

            this.log(`Basic resources fetched for ${address} - bal: ${coin_store_value} - stake: ${stake_pool_active_value}`);
            return data;
        } catch (error) {
            this.log(`Error fetching resources for ${address}: ${error.message}`);
            data.merged = {data: {resources: []}};
            return data;
        }
    }
}

// For systemd, this is how we launch
if (process.env.NODE_ENV && !["test", "development"].includes(process.env.NODE_ENV)) {
    const redisUrl = process.env.REDIS_URL;
    console.log(new Date(), "ValidatorsList service starting using redis url: ", redisUrl);

    ValidatorsList.create(redisUrl).then(() => {
        console.log(new Date(), "ValidatorsList service start complete.");
    });
} else {
    console.log(new Date(), "ValidatorsList detected test/development environment, not starting in systemd bootstrap.");
}

module.exports = ValidatorsList;
