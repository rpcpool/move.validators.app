# frozen_string_literal: true

class ValidatorJob
  include Sidekiq::Job

  def perform(validator_data)
    puts "received validator data: #{validator_data}"
    # Access the validator data from the job arguments
    address = validator_data['address']
    voting_power = validator_data['votingPower']
    consensus_public_key = validator_data['consensusPublicKey']
    fullnode_addresses = validator_data['fullnodeAddresses']
    network_addresses = validator_data['networkAddresses']
    validator_index = validator_data['validatorIndex']
    domain = validator_data['domain'] || nil

    # TODO: Need to add network - this should come from the config

    validator = Validator.find_or_create_by(address: address) do |validator|
      validator.name = Faker::Company.name
      validator.validator_index = validator_index
      validator.address = address
      validator.voting_power = voting_power
      validator.consensus_public_key = consensus_public_key
      validator.fullnode_address = fullnode_addresses
      validator.network_address = network_addresses
      validator.domain = domain
    end

    # If the validator already exists, update the attributes
    if validator.persisted?
      validator.update(
        validator_index: validator_index,
        voting_power: voting_power,
        consensus_public_key: consensus_public_key,
        fullnode_address: fullnode_addresses,
        network_address: network_addresses,
        domain: domain
      )
    end

  end
end
