# frozen_string_literal: true
include ApplicationHelper

class ValidatorPerformanceJob
  include Sidekiq::Job

  # Configure uniqueness to allow updates based on epoch
  sidekiq_options(
    queue: :default,
    retry: false,
    lock: :until_executed,
    lock_args: ->(args) { [args.first['epoch']] }, # Use epoch for uniqueness
    on_conflict: :replace # Replace existing job if conflict
  )

  REQUIRED_FIELDS = %w[
    epoch
    performances
  ].freeze

  REQUIRED_PERFORMANCE_FIELDS = %w[
    validator_address
    voting_power
    successful_proposals
    total_proposals
    epoch
  ].freeze

  def perform(performance_data)
    validate_performance_data!(performance_data)
    process_performance_data(performance_data)

  rescue StandardError => e
    Rails.logger.error("!!! VALIDATOR PERFORMANCE JOB FAILED !!!")
    Rails.logger.error("!!! Error: #{e.class} - #{e.message} !!!")
    Rails.logger.error("!!! Performance Data: #{performance_data.inspect} !!!")
    Rails.logger.error(e.backtrace.join("\n"))
  end

  private

  def validate_performance_data!(data)
    # Check for required top-level fields
    missing_fields = REQUIRED_FIELDS - data.keys
    if missing_fields.any?
      raise ArgumentError, "Missing required fields: #{missing_fields.join(', ')}"
    end

    # Validate epoch format
    unless data['epoch'].is_a?(String) && data['epoch'].match?(/^\d+$/)
      raise ArgumentError, "Invalid epoch format: #{data['epoch']}"
    end

    # Validate performances array
    unless data['performances'].is_a?(Array)
      raise ArgumentError, "Performances must be an array"
    end

    # Validate each performance entry
    data['performances'].each do |perf|
      missing_perf_fields = REQUIRED_PERFORMANCE_FIELDS - perf.keys
      if missing_perf_fields.any?
        raise ArgumentError, "Missing performance fields: #{missing_perf_fields.join(', ')} for validator #{perf['validator_address']}"
      end

      validate_performance_fields!(perf)
    end
  end

  def validate_performance_fields!(perf)
    # Validate numeric fields
    unless perf['successful_proposals'].is_a?(Integer) && perf['successful_proposals'] >= 0
      raise ArgumentError, "Invalid successful_proposals format: #{perf['successful_proposals']}"
    end

    unless perf['total_proposals'].is_a?(Integer) && perf['total_proposals'] >= 0
      raise ArgumentError, "Invalid total_proposals format: #{perf['total_proposals']}"
    end

    unless perf['voting_power'].is_a?(String) && perf['voting_power'].match?(/^\d+$/)
      raise ArgumentError, "Invalid voting_power format: #{perf['voting_power']}"
    end

    # Validate epoch matches parent epoch
    unless perf['epoch'].is_a?(String) && perf['epoch'].match?(/^\d+$/)
      raise ArgumentError, "Invalid epoch format in performance: #{perf['epoch']}"
    end
  end

  def process_performance_data(performance_data)
    validator_id_column = "validators_#{network}_id"
    epoch_history_id_column = "epoch_histories_#{network}_id"
    epoch = performance_data["epoch"]
    performances = performance_data["performances"]

    epoch_history = EpochHistory.find_by(epoch: epoch)
    unless epoch_history
      Rails.logger.error("!!! Epoch history not found for epoch #{epoch} !!!")
      return
    end

    performances.each do |perf|
      begin
        validator = Validator.find_by(address: perf["validator_address"])
        unless validator
          Rails.logger.error("!!! Validator not found for address #{perf["validator_address"]} !!!")
          next
        end

        performance_score = calculate_score(perf["successful_proposals"], perf["total_proposals"])

        attributes = {
          validator_address: perf["validator_address"],
          "#{validator_id_column}": validator.id,
          "#{epoch_history_id_column}": epoch_history.id,
          epoch: epoch,
          successful_proposals: perf["successful_proposals"],
          total_proposals: perf["total_proposals"],
          voting_power: perf["voting_power"],
          performance_score: performance_score
        }

        ValidatorPerformance.upsert(
          attributes,
          on_duplicate: :update
        )

        # Update the validator's current performance score
        validator.update_column(:performance, performance_score)
        Rails.logger.info("Successfully processed performance for validator #{validator.address} with score #{performance_score}")

      rescue StandardError => e
        Rails.logger.error("Error processing performance for validator #{perf["validator_address"]}: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))
      end
    end
  end

  def calculate_score(successful, total)
    return 0.0 if total.zero?
    (successful.to_f / total * 100).round(2)
  end
end
