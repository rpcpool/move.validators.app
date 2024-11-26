# frozen_string_literal: true

class ValidatorJob
  include Sidekiq::Job

  def perform(validator_data)
    return if validator_data.nil?

    puts "Received validator data: #{validator_data.to_json}"

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

    stake_pool_active_value = validator_data.dig('merged', 'data', 'stake_pool_active_value').to_i

    coin_store_value = validator_data.dig('merged', 'data', 'coin_store_value').to_i

    begin
      # Try to find the validator by address
      validator = Validator.find_by(address: address)

      if validator
        puts " > Updating validator with name #{name}"
        # If the validator exists, update its attributes explicitly
        validator.update!(
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
