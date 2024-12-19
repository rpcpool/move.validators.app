# frozen_string_literal: true

class ValidatorRewardsJob
  include Sidekiq::Job

  # Configure uniqueness to allow updates based on validator rewards
  sidekiq_options(
    queue: :default,
    retry: 3,
    lock: :until_executed,
    lock_args: ->(args) { 
      Rails.logger.info "ValidatorRewardsJob calculating lock args for #{args.first&.keys&.count} validators"
      args.first.keys 
    },
    on_conflict: :replace # Replace existing job if conflict
  )

  def perform(validator_rewards_data)
    Rails.logger.info "Starting ValidatorRewardsJob with #{validator_rewards_data&.keys&.count} validators"
    Rails.logger.info "Validator addresses: #{validator_rewards_data&.keys&.join(', ')}"
    return if validator_rewards_data.nil?

    validator_rewards_data.each do |validator_address, validator_data|
      process_validator(validator_address, validator_data)
    end
  rescue StandardError => e
    Rails.logger.error("!!! VALIDATOR REWARDS JOB FAILED !!!")
    Rails.logger.error("!!! Error: #{e.class} - #{e.message} !!!")
    Rails.logger.error("!!! Data: #{validator_rewards_data.inspect} !!!")
    Rails.logger.error(e.backtrace.join("\n"))
    raise # Re-raise to trigger Sidekiq retry
  end

  private

  def validate_reward!(reward)
    unless reward["version_info"]
      raise ArgumentError, "Missing version_info for reward"
    end

    required_fields = %w[version sequence amount]
    missing_fields = required_fields - reward.keys
    if missing_fields.any?
      raise ArgumentError, "Missing required reward fields: #{missing_fields.join(', ')}"
    end

    version_info_fields = %w[block_timestamp block_height]
    missing_version_fields = version_info_fields - reward["version_info"].keys
    if missing_version_fields.any?
      raise ArgumentError, "Missing required version_info fields: #{missing_version_fields.join(', ')}"
    end
  end

  def process_validator(validator_address, validator_data)
    Rails.logger.info "Processing rewards for validator: #{validator_address}"
    
    # Update validator voting power if present
    validator = Validator.find_by(address: validator_address)
    if validator
      if validator_data["voting_power"].present?
        Rails.logger.info "Updating voting power for #{validator_address} to #{validator_data['voting_power']}"
        validator.update(voting_power: validator_data["voting_power"])
      end
    else
      Rails.logger.warn "Validator not found for address: #{validator_address}"
      return
    end

    # Process rewards
    return unless validator_data["rewards"].present?

    Rails.logger.info "Found #{validator_data['rewards'].count} rewards for validator: #{validator_address}"
    
    total_rewards = 0
    validator_data["rewards"].each do |reward|
      validate_reward!(reward)
      save_reward(validator_address, reward)
      total_rewards += reward["amount"].to_i
    end

    # Update validator's total rewards
    current_rewards = validator.rewards.present? ? validator.rewards.to_i : 0
    validator.update!(rewards: (current_rewards + total_rewards).to_s)
    Rails.logger.info "Updated total rewards for validator #{validator_address} to #{validator.rewards}"
  end

  def save_reward(validator_address, reward)
    version_info = reward["version_info"]

    # Parse datetime from timestamp - ensure UTC
    reward_datetime = Time.at(version_info["block_timestamp"].to_i / 1_000_000).utc

    attributes = {
      validator_address: validator_address,
      version: reward["version"],
      sequence: reward["sequence"],
      amount: reward["amount"],
      block_height: version_info["block_height"],
      block_timestamp: version_info["block_timestamp"],
      reward_datetime: reward_datetime
    }

    Rails.logger.info(
      "Saving reward: validator=#{validator_address} " \
      "version=#{reward['version']} " \
      "amount=#{reward['amount']} " \
      "block_height=#{version_info['block_height']}"
    )

    # Find or create the reward record
    existing_reward = ValidatorReward.find_by(
      validator_address: validator_address,
      version: reward["version"]
    )

    if existing_reward
      existing_reward.update!(attributes)
      Rails.logger.info "Updated existing reward for validator #{validator_address} version #{reward['version']}"
    else
      ValidatorReward.create!(attributes)
      Rails.logger.info "Created new reward for validator #{validator_address} version #{reward['version']}"
    end
  rescue ActiveRecord::RecordNotUnique => e
    # Handle race condition where another process created the record
    # after our find_by but before our create
    Rails.logger.warn "Race condition detected, retrying save_reward"
    retry
  end
end
