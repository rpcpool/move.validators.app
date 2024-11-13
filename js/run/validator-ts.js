const {Aptos, AptosConfig, Network} = require("@aptos-labs/ts-sdk");
const network = Network.TESTNET;
const aptosConfig = new AptosConfig({network});
const client = new Aptos(aptosConfig);

async function getEpochTimestamp(accountAddress,network="testnet") {
    function convertToDate(microseconds) {
        const milliseconds = parseInt(microseconds) / 1000; // Convert to milliseconds
        const date = new Date(milliseconds); // Convert to Date object
        return date.toISOString(); // Convert to ISO string format
    }

    let url;
    try {

        url = `https://api.${network}.aptoslabs.com/v1/accounts/${accountAddress}/events/0x1::stake::StakePool/add_stake_events`;
        let stakeEvents;
        try {
            const response = await fetch(url);
            stakeEvents = await response.json(); // Parsing the response body as JSON
            // console.log('Status Code:', response.status);
            // console.log('Response Body:', JSON.stringify(stakeEvents, null, 4));
        } catch (error) {
            console.error('Error fetching events:', error);
        }

        const version = stakeEvents?.[0]?.version;
        if (version) {
            url = `https://api.${network}.aptoslabs.com/v1/blocks/by_version/${version}`
            try {
                const response = await fetch(url);
                const block = await response.json(); // Parsing the response body as JSON
                // console.log('Response Body:', JSON.stringify(block, null, 4));

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

const validatorAddress = "0x03c04549114877c55f45649aba48ac0a4ff086ab7bdce3b8cc8d3d9947bc0d99";
getEpochTimestamp(validatorAddress).then(r => {
    console.log(r);
});