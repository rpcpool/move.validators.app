# frozen_string_literal: true
include ApplicationHelper

class ValidatorPerformanceJob
  include Sidekiq::Job

  def perform(performance_data)
    puts "Got performance data: #{performance_data.inspect}"

    return if performance_data.nil?

    validator_id_column = "validators_#{network}_id"
    epoch_history_id_column = "epoch_histories_#{network}_id"
    epoch = performance_data["epoch"]
    performances = performance_data["performances"]

    return if epoch.nil? || performances.nil?

    performances.each do |perf|
      validator = Validator.find_by(address: perf["validator_address"])
      epoch_history = EpochHistory.find_by(epoch: epoch)

      next unless validator && epoch_history

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
        on_duplicate: [:validator_address, :epoch]
      )

      # Update the validator
      validator.update_column(:performance, performance_score)
      puts " Updated validator (#{validator.id}) #{validator.address} with performance #{performance_score}"
    rescue => e
      Rails.logger.error "Error processing performance for validator #{perf["validator_address"]}: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
    end
  end

  private

  def calculate_score(successful, total)
    return 0 if total.zero?
    (successful.to_f / total * 100).round(2)
  end
end