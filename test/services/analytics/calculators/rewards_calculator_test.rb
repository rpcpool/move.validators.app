require "test_helper"

module Services
  module Analytics
    module Calculators
      class RewardsCalculatorTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator"
          )

          @calculator = RewardsCalculator.new(@validator)

          # Setup some test rewards
          @today = Date.today
          @week_ago = @today - 7.days
        end

        # Total Rewards Tests
        test "calculates total rewards" do
          create_rewards(100, @today)
          create_rewards(200, @today - 1.day)

          assert_equal 300.0, @calculator.calculate_total_rewards
        end

        test "returns 0 for validator with no rewards" do
          assert_equal 0.0, @calculator.calculate_total_rewards
        end

        # Period Rewards Tests
        test "calculates rewards for specific period" do
          # Create rewards inside the period
          create_rewards(100, @today)
          create_rewards(200, @today - 1.day)

          # Create rewards outside the period
          create_rewards(300, @today - 10.days)

          period_rewards = @calculator.calculate_period_rewards(@today - 2.days, @today)
          assert_equal 300.0, period_rewards
        end

        test "handles empty period" do
          period_rewards = @calculator.calculate_period_rewards(@today, @today + 1.day)
          assert_equal 0.0, period_rewards
        end

        test "includes full days in period calculation" do
          create_rewards(100, @today.beginning_of_day)
          create_rewards(100, @today.end_of_day)

          period_rewards = @calculator.calculate_period_rewards(@today, @today)
          assert_equal 200.0, period_rewards
        end

        # Growth Rate Tests
        test "calculates positive growth rate" do
          rate = @calculator.calculate_rewards_growth_rate(200, 100)
          assert_equal 100.0, rate # 100% growth should map to 100
        end

        test "calculates negative growth rate" do
          rate = @calculator.calculate_rewards_growth_rate(50, 100)
          assert_equal 0.0, rate # -100% growth should map to 0
        end

        test "handles zero previous rewards" do
          rate = @calculator.calculate_rewards_growth_rate(100, 0)
          assert_equal 50.0, rate # Should return middle of scale
        end

        test "handles zero current rewards" do
          rate = @calculator.calculate_rewards_growth_rate(0, 100)
          assert_equal 0.0, rate # Should map to minimum
        end

        test "handles nil values" do
          rate = @calculator.calculate_rewards_growth_rate(nil, nil)
          assert_equal 50.0, rate # Should return middle of scale
        end

        test "clamps extreme growth rates" do
          # Test 200% growth (should clamp to 100)
          high_rate = @calculator.calculate_rewards_growth_rate(300, 100)
          assert_equal 100.0, high_rate

          # Test -200% growth (should clamp to 0)
          low_rate = @calculator.calculate_rewards_growth_rate(-100, 100)
          assert_equal 0.0, low_rate
        end

        # Period Rewards and Growth Tests
        test "calculates period rewards and growth" do
          # Current period rewards
          create_rewards(200, @today)
          create_rewards(200, @today - 1.day)

          # Previous period rewards
          create_rewards(100, @today - 8.days)
          create_rewards(100, @today - 9.days)

          result = @calculator.period_rewards_and_growth(@today - 2.days, @today)

          assert_equal 400.0, result[:rewards]
          assert_equal 100.0, result[:growth_rate] # 100% growth (doubled)
        end

        test "handles no rewards in either period" do
          result = @calculator.period_rewards_and_growth(@today - 2.days, @today)

          assert_equal 0.0, result[:rewards]
          assert_equal 50.0, result[:growth_rate]
        end

        test "handles rewards only in current period" do
          create_rewards(100, @today)

          result = @calculator.period_rewards_and_growth(@today, @today)

          assert_equal 100.0, result[:rewards]
          assert_equal 50.0, result[:growth_rate]
        end

        test "handles rewards only in previous period" do
          create_rewards(100, @today - 8.days)

          result = @calculator.period_rewards_and_growth(@today - 1.day, @today)

          assert_equal 0.0, result[:rewards]
          assert_equal 0.0, result[:growth_rate]
        end

        private

        def create_rewards(amount, date)
          ValidatorReward.create!(
            validator_address: @validator.address,
            amount: amount.to_s,
            block_height: rand(1..1000000),
            block_timestamp: date.to_time.to_i.to_s,
            reward_datetime: date,
            sequence: rand(1..1000000),
            version: rand(1..1000000)
          )
        end
      end
    end
  end
end