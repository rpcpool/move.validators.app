module Services
  module Analytics
    module Compute
      class RewardsGrowth
        def self.call(validator)
          new(validator).call
        end

        def initialize(validator)
          @validator = validator
        end

        def call
          current_rewards = calculate_period_rewards(7.days.ago, Time.current)
          previous_rewards = calculate_period_rewards(14.days.ago, 7.days.ago)

          return 50.0 if previous_rewards.zero? # Middle of scale if no previous rewards

          growth_rate = ((current_rewards - previous_rewards) / previous_rewards) * 100

          # Normalize to 0-100 range
          normalized_growth = growth_rate.clamp(-100, 100)
          ((normalized_growth + 100) / 2).round(2)
        end

        private

        def calculate_period_rewards(start_date, end_date)
          @validator.validator_rewards
                    .where(created_at: start_date.beginning_of_day..end_date.end_of_day)
                    .sum(:amount)
                    .to_f
        end
      end
    end
  end
end