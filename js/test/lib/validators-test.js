const { test, refute } = require("../../lib/test/lite-test");
const assert = require("assert");
const { Aptos, AptosConfig, Network } = require("@aptos-labs/ts-sdk");

test("fetch validator details", async () => {
  const aptosConfig = new AptosConfig({
    network: Network.TESTNET,
  });

  const aptos = new Aptos(aptosConfig);

  // when testing we want to:
  // mock all the data out for the call
  // override the interval in the class so it does not run
  // create the mock queue
  // verify the data is correct

  async function fetchValidatorDetails() {
    try {
      console.log(
        "Fetching validators for account: 0x1 with resource: 0x1::stake::ValidatorSet",
      );

      const resources = await aptos.account.getAccountResources({
        accountAddress: "0x1",
      });

      const validatorSetResource = resources.find(
        (resource) => resource.type === "0x1::stake::ValidatorSet",
      );

      if (validatorSetResource) {
        const validators = validatorSetResource.data.active_validators;

        console.log("Aptos Validators on Testnet:");
        for (const [index, validator] of validators.entries()) {
          console.log(`Validator ${index + 1}:`);
          console.log("  Address:", validator.addr);
          console.log("  Voting Power:", validator.voting_power);
          console.log(
            "  Consensus Public Key:",
            validator.config.consensus_pubkey,
          );
          console.log(
            "  Fullnode Addresses:",
            validator.config.fullnode_addresses,
          );
          console.log(
            "  Network Addresses:",
            validator.config.network_addresses,
          );
          const decodedNetworkAddress = decodeNetworkAddress(
            validator.config.network_addresses,
          );
          console.log("  Decoded Network Address:", decodedNetworkAddress);
          console.log("  Validator Index:", validator.config.validator_index);
          console.log("------------------------");

          // Fetch additional details or staking address
          const stakingResources = await aptos.account.getAccountResources({
            accountAddress: validator.addr,
          });

          const stakingResource = stakingResources.find(
            (resource) => resource.type === "0x1::stake::StakingConfig",
          );

          if (stakingResource) {
            console.log(
              `Staking Address for Validator ${index + 1}: ${stakingResource.data.staking_address}`,
            );
          } else {
            console.log(`Staking Address not found for Validator ${index + 1}`);
          }
          console.log("------------------------");
        }
      } else {
        console.log("ValidatorSet resource not found.");
      }
    } catch (error) {
      console.error("Error fetching validators:", error.message || error);
      console.error(error);
    }
  }

  function decodeNetworkAddress(encodedAddress) {
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

    return "No valid domain found";
  }

  // await fetchValidatorDetails();
});
