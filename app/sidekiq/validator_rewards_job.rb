# frozen_string_literal: true

class ValidatorRewardsJob
  include Sidekiq::Job

  def perform(validator_rewards_data)
    return if validator_rewards_data.nil?

    validator_rewards_data.each do |validator_address, validator_data|
      process_validator(validator_address, validator_data)
    end
  end

  private

  def process_validator(validator_address, validator_data)
    # Update validator voting power if present
    if validator_data["voting_power"].present?
      validator = Validator.find_by(address: validator_address)
      validator&.update(voting_power: validator_data["voting_power"])
    end

    # Process rewards
    return unless validator_data["rewards"].present?

    validator_data["rewards"].each do |reward|
      next unless reward["version_info"] # Skip if no version info

      save_reward(validator_address, reward)
    end
  end

  def save_reward(validator_address, reward)
    version_info = reward["version_info"]

    attributes = {
      validator_address: validator_address,
      version: reward["version"],
      sequence: reward["sequence"],
      amount: reward["amount"],
      block_height: version_info["block_height"],
      block_timestamp: version_info["block_timestamp"],
      reward_datetime: version_info["datetime"]
    }

    ValidatorReward.upsert_all(
      [attributes],
      update_only: %w[sequence amount block_height block_timestamp reward_datetime]
    )
  rescue => e
    Rails.logger.error "Error processing reward for validator #{validator_address}: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
  end

end