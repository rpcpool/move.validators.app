# frozen_string_literal: true

module Services
  module Analytics
    module Metrics
      class ValidatorMetrics
        include Services::Analytics::Normalizer
        APTOS_START_DATE = Date.parse('2022-10-12')

        attr_reader :validator

        def initialize(validator)
          @validator = validator
        end

        def data_center_score
          @data_center_score ||= distance_calculator.calculate_data_center_score
        end

        def voting_record_score
          @voting_record_score ||= score_calculator.calculate_voting_record_score
        end

        def last_epoch_score
          @last_epoch_score ||= score_calculator.calculate_last_epoch_score
        end

        def start_date_score
          @start_date_score ||= score_calculator.calculate_start_date_score
        end

        def overall_score
          @overall_score ||= score_calculator.calculate_overall_score(
            performance_score: @validator.performance,
            data_center_score: data_center_score
          )
        end

        def performance_score
          @performance_score ||= performance_calculator.calculate_performance_score
        end

        def weekly_performance_metrics(weeks_back = 3)
          performance_calculator.weekly_performance_metrics(weeks_back)
        end

        private

        def distance_calculator
          @distance_calculator ||= Calculators::DistanceCalculator.new(validator)
        end

        def score_calculator
          @score_calculator ||= Calculators::ScoreCalculator.new(validator)
        end

        def performance_calculator
          @performance_calculator ||= Calculators::PerformanceCalculator.new(validator)
        end
      end
    end
  end
end