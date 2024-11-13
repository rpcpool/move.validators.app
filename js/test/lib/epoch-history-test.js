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

    // Get the reconfiguration configuration
    const reconfigurationConfig = getItem(data, '0x1::reconfiguration::Configuration');

    // Get the block resource
    const blockResource = getItem(data, '0x1::block::BlockResource');
    // console.log(JSON.stringify(blockResource, null, 2));

    // Extract relevant data with conditional checks
    const epoch = reconfigurationConfig && reconfigurationConfig.data ? reconfigurationConfig.data.epoch : null;
    const lastReconfigurationTime = reconfigurationConfig && reconfigurationConfig.data ? reconfigurationConfig.data.last_reconfiguration_time : null;
    const epochInterval = blockResource && blockResource.data ? blockResource.data.epoch_interval : null;

    console.log('Epoch:', epoch);
    console.log('Last Reconfiguration Time:', lastReconfigurationTime);
    console.log('Epoch Interval:', epochInterval);

    // Get the validator set
    const validatorSet = getItem(data, '0x1::stake::ValidatorSet');

    // Extract the total number of validators
    const totalValidators = validatorSet && validatorSet.data ? validatorSet.data.active_validators.length : 0;

    console.log('Total Validators:', totalValidators);

    // Extract the starting slot
    const startingSlot = blockResource && blockResource.data && blockResource.data.new_block_events ? blockResource.data.new_block_events.counter : null;

    console.log('Starting Slot:', startingSlot);

    // Assuming epoch_interval is in microseconds and slot duration is also in microseconds (no hardcoding)
    const slotsInEpoch = epochInterval ? parseInt(epochInterval, 10) : null;

    console.log('Slots in Epoch:', slotsInEpoch);

    // Extract the current height
    const currentHeight = blockResource && blockResource.data ? blockResource.data.height : null;

    console.log('Current Height:', currentHeight);

    // Extract the total staked value
    const totalStaked = validatorSet && validatorSet.data ? validatorSet.data.total_voting_power : null;

    console.log('Total Staked:', totalStaked);


    const numberOfValidators = validatorSet && validatorSet.data && validatorSet.data.active_validators ? validatorSet.data.active_validators.length : null;

    // Calculate the average validator stake
    const averageValidatorStake = totalStaked && numberOfValidators ? BigInt(totalStaked) / BigInt(numberOfValidators) : null;

    console.log('Average Validator Stake:', averageValidatorStake ? averageValidatorStake.toString() : null);


    // console.log('Total staked:', totalStaked);
    // console.log('Average Validator Stake:', averageValidatorStake);
    // console.log('Total Rewards:', totalRewards);
    // console.log('Epoch Completion Percentage:', epochCompletionPercentage.toFixed(2), '%');
}

function getItem(data, key) {
    return data.find(item => item.type.includes(key));
}

function allItems(data, key) {
    return data.filter(item => item.type.includes(key));
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

function decodeConfig(configHex) {
    const configBytes = Buffer.from(configHex.slice(2), 'hex');

    return {
        maxBytesPerMessage: configBytes.readUInt32LE(0),
        maxExecutionGasPerMessage: Number(configBytes.readBigUInt64LE(4)),
        maxGasPerAccount: Number(configBytes.readBigUInt64LE(12)),
        maxTxnSize: Number(configBytes.readBigUInt64LE(20)),
        gasPrice: Number(configBytes.readBigUInt64LE(28)),
        gasPerSecond: Number(configBytes.readBigUInt64LE(36)),
        diskGasPerByte: Number(configBytes.readBigUInt64LE(44)),
        senderAuthenticityChallengeDelay: configBytes.readUInt32LE(52),
        senderChallengeTimeout: configBytes.readUInt32LE(56),
        safetyRules: {
            epochLength: configBytes.readUInt32LE(60),
            subEpochLength: configBytes.readUInt32LE(64),
            leaderRepeatInterval: configBytes.readUInt32LE(68),
            voterRepeatInterval: configBytes.readUInt32LE(72),
            numMempoolRejectionVotes: configBytes.readUInt32LE(76),
            numCommitVotesThreshold: configBytes.readUInt32LE(80),
            numExecutionVotesThreshold: configBytes.readUInt32LE(84)
        }
    };
}

