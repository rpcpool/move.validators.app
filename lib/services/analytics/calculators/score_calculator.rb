# frozen_string_literal: true

module Services
  module Analytics
    module Calculators
      class ScoreCalculator
        include Services::Analytics::Normalizer

        def initialize(validator)
          @validator = validator
        end

        def calculate_voting_record_score
          return 0 if @validator.voting_record.nil? || @validator.voting_record.empty?

          delivered, total = @validator.voting_record.split('/').map(&:to_f)
          return 0 if total.nil? || total.zero?

          (delivered / total) * 100
        end

        def calculate_last_epoch_score
          # Get the latest performance record for this validator
          latest_performance = @validator.validator_performances
            .order(epoch: :desc)
            .first

          return 0 unless latest_performance
          return 0 if latest_performance.total_proposals.zero?

          # Calculate score as per Aptos definition:
          # (number of successful proposals) / (number of total proposal opportunities) * 100
          (latest_performance.successful_proposals.to_f / latest_performance.total_proposals * 100).round(2)
        end

        def calculate_overall_score(performance_score: nil, data_center_score: nil)
          voting_score = calculate_voting_record_score
          last_epoch_score = calculate_last_epoch_score
          performance_score ||= @validator.performance || 0
          data_center_score ||= @validator.data_center_score || 0

          (
            (voting_score * 0.25) +
              (last_epoch_score * 0.25) +
              (performance_score * 0.25) +
              (data_center_score * 0.25)
          ).round(2)
        end

        def calculate_start_date_score
          start_date_parsed = parse_date(@validator.start_date)

          # Use Aptos start as the max date and today as the min date
          max_date = ValidatorMetrics::APTOS_START_DATE
          min_date = Date.today

          # Clamp the start date to the valid range
          start_date_clamped = start_date_parsed.clamp(max_date, min_date)

          # Normalize the start date, giving older dates higher scores
          normalize_date(start_date_clamped, max_date, min_date)
        end
      end
    end
  end
end
