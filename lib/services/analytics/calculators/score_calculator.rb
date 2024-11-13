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
          # Convert last_epoch_perf to an integer if it's a string
          last_epoch_perf = @validator.last_epoch_perf.to_i if @validator.last_epoch_perf.is_a?(String)

          # If last_epoch_perf is missing or zero, treat it as 0
          return 0 if last_epoch_perf.nil? || last_epoch_perf.zero?

          # Convert start date to datetime
          start_date = parse_date(@validator.start_date)

          # Calculate how many days ago the validator started
          days_ago = (DateTime.now - start_date).to_i

          # Normalize last epoch performance, factoring in recency
          last_epoch_score = if days_ago < 365
                               (last_epoch_perf / 4000.0) * (days_ago / 365.0) * 100
                             else
                               (last_epoch_perf / 4000.0) * 100
                             end

          last_epoch_score = last_epoch_score.clamp(0, 100)

          # Return 0 if the score calculation results in NaN
          last_epoch_score.nan? ? 0 : last_epoch_score
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