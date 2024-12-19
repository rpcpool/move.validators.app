# frozen_string_literal: true

class ValidatorJob
  include Sidekiq::Job

  sidekiq_options queue: :default, retry: false

  REQUIRED_FIELDS = %w[
    address votingPower consensusPublicKey fullnodeAddress
    networkAddress validatorIndex name operator_address
  ].freeze

  def perform(validator_data)
    return if validator_data.nil?

    begin
      process_validator(validator_data)
    rescue StandardError => e
      Rails.logger.error("!!! VALIDATOR JOB FAILED !!!")
      Rails.logger.error("!!! Error: #{e.class} - #{e.message} !!!")
      Rails.logger.error("!!! Validator Data: #{validator_data.inspect} !!!")
      Rails.logger.error(e.backtrace.join("\n"))
      # Don't raise - let the job fail silently since we'll get new data next interval
    end
  end

  private

  def validate_data!(data)
    missing_fields = REQUIRED_FIELDS - data.keys
    if missing_fields.any?
      Rails.logger.warn("Missing fields in validator data: #{missing_fields.join(', ')}")
      return false
    end

    # Validate numeric fields but don't fail if they're invalid
    ['votingPower', ['merged', 'data', 'stake_pool_active_value'], ['merged', 'data', 'coin_store_value']].each do |field|
      value = field.is_a?(Array) ? field.reduce(data) { |obj, key| obj&.[](key) } : data[field]
      unless value.nil? || (value.is_a?(String) && value.match?(/^\d+$/))
        Rails.logger.warn("Invalid numeric format for #{field.is_a?(Array) ? field.join('.') : field}: #{value}")
        return false
      end
    end

    true
  end

  def process_validator(data)
    return unless validate_data!(data)

    attributes = build_validator_attributes(data)
    validator = Validator.find_by(address: attributes[:address])

    Rails.logger.info("\n#{attributes}\n")

    if validator
      Rails.logger.info(" > Updating validator with name #{attributes[:name]}")
      # Only update fields that have valid values
      filtered_attributes = attributes.reject { |_, v| v.nil? }
      validator.update!(filtered_attributes)
    else
      Rails.logger.info(" > Creating new validator with name #{attributes[:name]}")
      Validator.create!(attributes)
    end
  end

  def build_validator_attributes(data)
    {
      address: data['address'],
      operator_address: data['operator_address'],
      name: data['name'],
      validator_index: data['validatorIndex'],
      voting_power: parse_numeric(data['votingPower']),
      consensus_public_key: data['consensusPublicKey'],
      fullnode_address: data['fullnodeAddress'],
      network_address: data['networkAddress'],
      domain: data['domain'],
      country_code: data.dig('ip_data', 'country_code').to_s,
      country: data.dig('ip_data', 'country').to_s,
      city: data.dig('ip_data', 'city').to_s,
      region: data.dig('ip_data', 'region').to_s,
      timezone: data.dig('ip_data', 'timezone').to_s,
      lat: parse_coordinate(data.dig('ip_data', 'lat')),
      lng: parse_coordinate(data.dig('ip_data', 'lng')),
      balance: parse_numeric(data.dig('merged', 'data', 'coin_store_value')),
      active_stake: parse_numeric(data.dig('merged', 'data', 'stake_pool_active_value')),
      start_date: data['start_date']
    }
  end

  def parse_coordinate(value)
    return 0.0 unless value
    value.to_f if value.is_a?(String) || value.is_a?(Numeric)
  end

  def parse_numeric(value)
    return nil unless value
    value.to_i if value.is_a?(String) && value.match?(/^\d+$/)
  end
end
