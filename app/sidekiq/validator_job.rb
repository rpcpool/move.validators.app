# frozen_string_literal: true

class ValidatorJob
  include Sidekiq::Job

  def perform(validator_data)
    return if validator_data.nil?

    # puts "Received validator data: #{validator_data.to_json}"

    # Extract values and add safeguards
    address = validator_data['address']
    voting_power = validator_data['votingPower']
    consensus_public_key = validator_data['consensusPublicKey']
    fullnode_address = validator_data['fullnodeAddress']
    network_address = validator_data['networkAddress']
    validator_index = validator_data['validatorIndex']
    domain = validator_data['domain'] || nil
    name = validator_data['name']
    country_code = validator_data.dig('ip_data', 'country_code').to_s
    country = validator_data.dig('ip_data', 'country').to_s
    city = validator_data.dig('ip_data', 'city').to_s
    region = validator_data.dig('ip_data', 'region').to_s
    timezone = validator_data.dig('ip_data', 'timezone').to_s
    start_date = validator_data['start_date']

    lat_value = validator_data.dig('ip_data', 'lat')
    lng_value = validator_data.dig('ip_data', 'lng')

    lat = lat_value.to_f if lat_value.is_a?(String) || lat_value.is_a?(Numeric)
    lng = lng_value.to_f if lng_value.is_a?(String) || lng_value.is_a?(Numeric)

    stake_pool_active_value = validator_data.dig('merged', 'resources')&.find { |resource|
      resource['type'] == '0x1::stake::StakePool'
    }&.dig('data', 'active', 'value').to_i

    coin_store_value = validator_data.dig('merged', 'resources')&.find { |resource|
      resource['type'] == '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
    }&.dig('data', 'coin', 'value').to_i

    last_epoch_perf = validator_data.dig('validator', 'last_epoch_performance')

    # Add logging to check for unexpected Hash
    if last_epoch_perf.is_a?(Hash)
      puts "Error: last_epoch_perf is a hash: #{last_epoch_perf.inspect}"
      last_epoch_perf = 0 # Assign a default value
    else
      last_epoch_perf = last_epoch_perf.to_i
    end

    rewards_growth = validator_data.dig('validator', 'rewards_growth')

    # Add safeguard to handle if rewards_growth is unexpectedly a hash
    if rewards_growth.is_a?(Hash)
      puts "Error: rewards_growth is a hash: #{rewards_growth.inspect}"
      rewards_growth = 0.0 # Assign a default value
    else
      rewards_growth = rewards_growth.to_f
    end

    voting_record = validator_data.dig('validator', 'governance_voting_record')
    rewards = validator_data.dig('validator', 'apt_rewards_distributed')

    begin
      # Try to find the validator by address
      validator = Validator.find_by(address: address)

      if validator
        # If the validator exists, update its attributes explicitly
        validator.update!(
          validator_index: validator_index,
          voting_power: voting_power,
          consensus_public_key: consensus_public_key,
          fullnode_address: fullnode_address,
          network_address: network_address,
          domain: domain,
          country_code: country_code,
          country: country,
          city: city,
          region: region,
          timezone: timezone,
          lat: lat,
          lng: lng,
          balance: coin_store_value,
          active_stake: stake_pool_active_value,
          # last_epoch_perf: last_epoch_perf,
          # rewards_growth: rewards_growth,
          # voting_record: voting_record,
          # rewards: rewards,
          start_date: start_date
        )
      else
        # If the validator doesn't exist, create it with the given attributes
        validator = Validator.create!(
          address: address,
          name: name,
          validator_index: validator_index,
          voting_power: voting_power,
          consensus_public_key: consensus_public_key,
          fullnode_address: fullnode_address,
          network_address: network_address,
          domain: domain,
          country_code: country_code,
          country: country,
          city: city,
          region: region,
          timezone: timezone,
          lat: lat,
          lng: lng,
          balance: coin_store_value,
          active_stake: stake_pool_active_value,
          # last_epoch_perf: last_epoch_perf,
          # rewards_growth: rewards_growth,
          # voting_record: voting_record,
          # rewards: rewards,
          start_date: start_date
        )
      end

    rescue => e
      # Log the error and the data that caused it
      puts "Error while creating/updating validator: #{e.message}"
      puts "Validator data that caused error: #{validator_data.to_json}"
      puts e.backtrace.join("\n")
      raise
    end

  end
end
