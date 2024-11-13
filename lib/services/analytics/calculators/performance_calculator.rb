# frozen_string_literal: true

module Services
  module Analytics
    module Calculators
      class PerformanceCalculator
        include Services::Analytics::Normalizer

        def initialize(validator)
          @validator = validator
        end

        # Calculates the performance score based on daily, weekly, and monthly blocks
        # How this works:
        # Normalize each value (bd, bw, bm) to a 0-100 scale.
        # Use weights to calculate the final performance score:
        #  40% daily blocks (bd)
        #  30% weekly blocks (bw)
        #  30% monthly blocks (bm)
        # Formula for Normalization:
        #  normalized value = (x - min(x) / max(x) - min(x)) * 100
        # weighted score:
        #  performance = (0.4 * bd_norm) + (0.3 * bw_norm) + (0.3 * bm_norm)
        def calculate_performance_score
          # Extract block data from model fields
          bd = @validator.blocks_purposed_day
          bw = @validator.blocks_purposed_week
          bm = @validator.blocks_purposed_month

          # Find min and max values for normalization
          bd_min, bd_max = Validator.minimum(:blocks_purposed_day), Validator.maximum(:blocks_purposed_day)
          bw_min, bw_max = Validator.minimum(:blocks_purposed_week), Validator.maximum(:blocks_purposed_week)
          bm_min, bm_max = Validator.minimum(:blocks_purposed_month), Validator.maximum(:blocks_purposed_month)

          # Normalize block values to 0-100 range
          bd_norm = normalize_value(bd, bd_min, bd_max)
          bw_norm = normalize_value(bw, bw_min, bw_max)
          bm_norm = normalize_value(bm, bm_min, bm_max)

          # Calculate the weighted performance score
          (0.4 * bd_norm) + (0.3 * bw_norm) + (0.3 * bm_norm)
        end

        def weekly_performance_metrics(weeks_back = 3)
          current_date = Date.today

          # Generate data for current week and previous weeks_back weeks
          (0..weeks_back).map do |week|
            start_date = current_date - (week * 7)
            end_date = start_date + 7

            # Calculate metrics for this week's period
            {
              period: week == 0 ? "This Week" : "#{week}w ago",
              metrics: calculate_period_metrics(start_date, end_date)
            }
          end.reverse # Reverse to show oldest first
        end

        private

        def blocks_for_period(start_date, end_date)
          days_in_period = (end_date - start_date).to_i

          {
            day: @validator.blocks_purposed_day,
            week: @validator.blocks_purposed_day * days_in_period,
            month: @validator.blocks_purposed_day * 30.44
          }
        end

        def calculate_period_metrics(start_date, end_date)
          # Get rewards data from RewardsCalculator
          rewards_data = rewards_calculator.period_rewards_and_growth(start_date, end_date)

          # Get other existing metrics
          period_blocks = blocks_for_period(start_date, end_date)
          period_performance = calculate_period_performance(period_blocks)

          {
            overall_score: Analytics::Metrics::ValidatorMetrics.new(@validator).overall_score,
            block_performance: period_performance,
            rewards_growth: rewards_data[:growth_rate]
          }
        end

        def calculate_period_performance(period_blocks)
          # Use the same weights as the original performance calculation
          bd_norm = normalize_value(period_blocks[:day], 800, 2000) # Using the random range from set_data
          bw_norm = normalize_value(period_blocks[:week], 800 * 7, 2000 * 7)
          bm_norm = normalize_value(period_blocks[:month], 800 * 30.44, 2000 * 30.44)

          (0.4 * bd_norm) + (0.3 * bw_norm) + (0.3 * bm_norm)
        end

        private

        def rewards_calculator
          @rewards_calculator ||= RewardsCalculator.new(@validator)
        end

      end
    end
  end
end