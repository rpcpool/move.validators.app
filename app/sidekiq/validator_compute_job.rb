# frozen_string_literal: true

class ValidatorComputeJob
  include Sidekiq::Job

  def perform(validator_id = nil)
    if validator_id
      # Compute for specific validator
      validator = Validator.find(validator_id)
      compute_metrics(validator)
    else
      # Compute for all validators
      Validator.find_each do |validator|
        compute_metrics(validator)
      end
    end
  end

  private

  def compute_metrics(validator)
    calculator = Services::Analytics::Calculators::ScoreCalculator.new(validator)
    
    # Get raw proposal numbers for last_epoch_perf
    latest_performance = validator.validator_performances.order(epoch: :desc).first
    last_epoch_perf = if latest_performance
      "#{latest_performance.successful_proposals} / #{latest_performance.total_proposals}"
    else
      "0 / 0"
    end
    
    # Calculate score separately for last_epoch_score
    last_epoch_score = calculator.calculate_last_epoch_score
    rewards_growth = Services::Analytics::Compute::RewardsGrowth.call(validator) || 0.0
    voting_record = Services::Analytics::Compute::VotingRecord.call(validator) || "0 / 0"
    rewards = Services::Analytics::Compute::TotalRewards.call(validator) || 0.0

    Rails.logger.info "Computing metrics for #{validator.address}: " \
                        "perf=#{last_epoch_perf}, " \
                        "growth=#{rewards_growth}, " \
                        "voting=#{voting_record}, " \
                        "rewards=#{rewards}"

    validator.update(
      last_epoch_perf: last_epoch_perf,
      last_epoch_score: last_epoch_score,
      rewards_growth: rewards_growth,
      voting_record: voting_record,
      rewards: rewards
    )
  rescue => e
    Rails.logger.error "Error computing metrics for validator #{validator.address}: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
  end
end
