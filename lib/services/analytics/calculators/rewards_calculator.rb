# frozen_string_literal: true

module Services
  module Analytics
    module Calculators
      class RewardsCalculator
        include Services::Analytics::Normalizer

        def initialize(validator)
          @validator = validator
        end

        def calculate_total_rewards
          @validator.validator_rewards.sum(:amount).to_f
        end

        def calculate_period_rewards(start_date, end_date)
          @validator.validator_rewards
                    .where(created_at: start_date.beginning_of_day..end_date.end_of_day)
                    .sum(:amount)
                    .to_f # we must have float
        end

        def calculate_rewards_growth_rate(current_rewards, previous_rewards)
          # Convert to float and handle zero/nil cases
          current = current_rewards.to_f
          previous = previous_rewards.to_f

          return 50.0 if previous == 0 # No growth (middle of scale) if no previous rewards

          growth_rate = ((current - previous) / previous) * 100

          # Normalize to fit within chart scale (0-100)
          # Cap at +/- 100% growth for visualization purposes
          normalized_growth = growth_rate.clamp(-100, 100)

          # Shift from -100..100 to 0..100 range for chart display
          ((normalized_growth + 100) / 2).round(2)
        end

        def period_rewards_and_growth(start_date, end_date)
          period_rewards = calculate_period_rewards(start_date, end_date)
          previous_period_rewards = calculate_period_rewards(start_date - 7.days, end_date - 7.days)

          {
            rewards: period_rewards,
            growth_rate: calculate_rewards_growth_rate(period_rewards, previous_period_rewards)
          }
        end
      end
    end
  end
end