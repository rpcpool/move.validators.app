const {test, refute} = require("../../lib/test/lite-test");
const assert = require("assert");
const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const fs = require("fs");

test("fetch validator details", async () => {
    const aptosConfig = new AptosConfig({
        network: Network.TESTNET,
    });

    const aptos = new Aptos(aptosConfig);


    async function fetchEpochHistory() {
        try {

            await latest(aptos);

        } catch (error) {
            console.error("Error fetching epoch history:", error.message || error);
            console.error(error);
        }
    }

    await fetchEpochHistory();
});

async function orig(aptos) {
    const data = await aptos.account.getAccountResources({
        accountAddress: "0x1",
    });

    // Extract values from BlockResource objects
    const blockResources = data.filter(item => item.type === "0x1::block::BlockResource").map(item => item.data);

    // Assuming the last BlockResource object represents the current state
    const latestBlockResource = blockResources[blockResources.length - 1];

    // Extract necessary values
    const epochInterval = parseInt(latestBlockResource.epoch_interval);
    const currentHeight = parseInt(latestBlockResource.height);
    const newBlockCounter = parseInt(latestBlockResource.new_block_events.counter);


    const blocksPerEpoch = epochInterval / 1e6; // Total blocks in an epoch

    // Calculate the blocks completed in the current epoch
    const blocksCompletedInEpoch = currentHeight % blocksPerEpoch;
    const epochCompletionPercentage = (blocksCompletedInEpoch / blocksPerEpoch) * 100;

    // Calculate the number of slots in the epoch
    const slotsInEpoch = Math.ceil(epochInterval / (currentHeight / newBlockCounter));


    // Extracting the values
    const network = "Testnet";
    const startingSlot = parseInt(data[0].data.last_completed.vec[0].metadata.dealer_epoch);
    const currentEpoch = parseInt(data[0].data.last_completed.vec[0].metadata.dealer_epoch);

    let totalStake = 0;
    data[0].data.last_completed.vec[0].metadata.dealer_validator_set.forEach(validator => {
        totalStake += parseInt(validator.voting_power);
    });

    const averageValidatorStake = totalStake / data[0].data.last_completed.vec[0].metadata.dealer_validator_set.length;
    const totalRewards = totalStake * 0.05; // Assuming a 5% reward rate for the example

    // Displaying the extracted values
    console.log('Network:', network);
    console.log('Starting Slot:', startingSlot);
    console.log('Slots in Epoch:', slotsInEpoch);
    console.log('Current Epoch:', currentEpoch);
    console.log('Total Stake:', totalStake);
    console.log('Average Validator Stake:', averageValidatorStake);
    console.log('Total Rewards:', totalRewards);

    console.log('Current Height:', currentHeight);
    console.log('Blocks per Epoch:', blocksPerEpoch);
    console.log('Epoch Completion Percentage:', epochCompletionPercentage.toFixed(2), '%');
}

async function latest(aptos) {
    // const data = await aptos.account.getAccountResources({
    //     accountAddress: "0x1",
    // });
    // fs.writeFileSync("./testnet.json", JSON.stringify(data, null, 2));

    const data = JSON.parse(fs.readFileSync("./testnet.json"));

    // Extract the Configuration object to get the current epoch
    const configuration = getItem(data, "0x1::reconfiguration::Configuration").data;
    const currentEpoch = parseInt(configuration.epoch);

    // Extract the ValidatorPerformance object to get the validators count
    const validatorData = getItem(data, "0x1::stake::ValidatorPerformance").data;
    const validatorsCount = validatorData.validators.length;

    // Extract the BlockResource object
    const blockResource = getItem(data, "0x1::block::BlockResource").data;

    // Extract the necessary values from the BlockResource object
    const epochIntervalUs = parseInt(blockResource.epoch_interval);
    const currentHeight = parseInt(blockResource.height);

    // Calculate the number of blocks per epoch (assuming 1 block per second)
    const blocksPerEpoch = epochIntervalUs / 1000000; // Total blocks in an epoch

    // Calculate the starting slot of the current epoch
    const startingSlot = currentHeight - (currentHeight % blocksPerEpoch);

    // Extract the ValidatorSet object to get the total staked amount
    const validatorSet = getItem(data, "0x1::stake::ValidatorSet").data;
    console.log("validatorSet:", JSON.stringify(validatorSet, null, 2));
    const totalStaked = validatorSet.total_voting_power;
    const averageValidatorStake = parseInt(totalStaked) / validatorsCount;

    // Extract the StakingRewardsConfig object
    const stakingRewardsConfig = getItem(data, "0x1::staking_config::StakingRewardsConfig").data;
    const validatorPerformance = getItem(data, "0x1::stake::ValidatorPerformance").data;

    console.log("stakingRewardsConfig:", stakingRewardsConfig);
    console.log("validatorPerformance:", validatorPerformance);

    // Extract necessary values as BigInt
    const currentRewardsRate = BigInt(stakingRewardsConfig.rewards_rate.value);
    // const periodInSeconds = BigInt(stakingRewardsConfig.rewards_rate_period_in_secs);
    // const totalRewards = String(currentRewardsRate * periodInSeconds);

    // Calculate total staked amount
    let totalStakedAmount = 0n;
    for (const validator of validatorSet.active_validators) {
        totalStakedAmount += BigInt(validator.voting_power);
    }

    // Calculate total successful proposals and total proposals
    let totalSuccessfulProposals = 0n;
    let totalProposals = 0n;

    for (const validator of validatorPerformance.validators) {
        const successfulProposals = BigInt(validator.successful_proposals);
        const failedProposals = BigInt(validator.failed_proposals);
        totalSuccessfulProposals += successfulProposals;
        totalProposals += successfulProposals + failedProposals;
    }

    // Extract necessary values as BigInt
    const rewardsRate = BigInt(stakingRewardsConfig.rewards_rate.value);
    const periodInSeconds = BigInt(stakingRewardsConfig.rewards_rate_period_in_secs);

    // Calculate per-epoch rewards rate
    const secondsInYear = 31536000n; // Number of seconds in a year
    const rewardsRatePerEpoch = (rewardsRate * periodInSeconds) / secondsInYear;

    // Calculate the performance ratio
    const performanceRatio = totalSuccessfulProposals / totalProposals;

    // Calculate the total rewards for the epoch
    const totalRewards = totalStakedAmount * rewardsRatePerEpoch * performanceRatio;


    // Displaying the extracted values
    console.log('Network:', 'Testnet');
    console.log('Current Epoch:', currentEpoch);
    console.log('Validators Count:', validatorsCount);
    console.log('Starting Slot:', startingSlot);
    console.log('Slots in epoch:', blocksPerEpoch);
    console.log('Current height:', currentHeight);
    console.log('Total staked:', totalStaked);
    console.log('Average Validator Stake:', averageValidatorStake);
    console.log('Total Rewards:', totalRewards);
    // console.log('Epoch Completion Percentage:', epochCompletionPercentage.toFixed(2), '%');
}

function getItem(data, key) {
    return data.find(item => item.type.includes(key));
}

function getValueByKey(obj, key) {
    for (const [k, v] of Object.entries(obj)) {
        if (k === key) {
            return v;
        } else if (typeof v === 'object') {
            const found = getValueByKey(v, key);
            if (found !== undefined) {
                return found;
            }
        }
    }
}

