require "test_helper"

module Services
  module Analytics
    module Compute
      class RewardsGrowthTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator"
          )
          @compute = RewardsGrowth.new(@validator)
        end

        test "returns 50 when no previous rewards exist" do
          assert_equal 50.0, @compute.call
        end

        test "calculates growth rate correctly for positive growth" do
          # Create rewards for previous period (7-14 days ago)
          create_rewards(100, 10.days.ago)

          # Create double the rewards for current period (0-7 days ago)
          create_rewards(200, 3.days.ago)

          # 100% growth should map to 100 on the 0-100 scale
          assert_equal 100.0, @compute.call
        end

        test "calculates growth rate correctly for negative growth" do
          # Create rewards for previous period
          create_rewards(200, 10.days.ago)

          # Create half the rewards for current period
          create_rewards(100, 3.days.ago)

          # -50% growth should map to 25 on the 0-100 scale
          assert_equal 25.0, @compute.call
        end

        test "handles zero current period rewards" do
          create_rewards(100, 10.days.ago)
          # No rewards for current period

          # -100% growth should map to 0 on the 0-100 scale
          assert_equal 0.0, @compute.call
        end

        test "clamps extreme positive growth" do
          create_rewards(100, 10.days.ago)
          create_rewards(1000, 3.days.ago)

          # 900% growth should be clamped to 100% which maps to 100
          assert_equal 100.0, @compute.call
        end

        test "clamps extreme negative growth" do
          create_rewards(1000, 10.days.ago)
          create_rewards(100, 3.days.ago)

          # -90% growth maps to 5 on the 0-100 scale
          assert_equal 5.0, @compute.call
        end

        test "calculates same day rewards correctly" do
          create_rewards(100, Time.current.beginning_of_day)
          create_rewards(100, Time.current.end_of_day)
          create_rewards(100, 8.days.ago)

          assert_equal 100.0, @compute.call
        end

        test "handles rewards at period boundaries" do
          create_rewards(100, 7.days.ago)
          create_rewards(100, 14.days.ago)

          # Equal rewards should result in 50 (no growth)
          assert_equal 50.0, @compute.call
        end

        test "includes full days in calculations" do
          create_rewards(50, 13.days.ago.end_of_day)
          create_rewards(50, 8.days.ago.beginning_of_day)
          create_rewards(200, 6.days.ago)

          assert_equal 100.0, @compute.call
        end

        test "class method produces same result as instance method" do
          create_rewards(100, 10.days.ago)
          create_rewards(200, 3.days.ago)

          assert_equal RewardsGrowth.new(@validator).call,
                       RewardsGrowth.call(@validator)
        end

        test "rounds result to two decimal places" do
          create_rewards(100, 10.days.ago)
          create_rewards(133, 3.days.ago)

          result = @compute.call
          assert_equal result.round(2), result
        end

        private

        def create_rewards(amount, timestamp)
          ValidatorReward.create!(
            validator_address: @validator.address,
            amount: amount.to_s,
            block_height: rand(1_000_000),
            block_timestamp: timestamp.to_i.to_s,
            reward_datetime: timestamp,
            sequence: rand(1_000_000),
            version: rand(1_000_000)
          )
        end
      end
    end
  end
end