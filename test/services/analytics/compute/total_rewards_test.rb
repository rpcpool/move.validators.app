require "test_helper"

module Services
  module Analytics
    module Compute
      class TotalRewardsTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator"
          )
          @compute = TotalRewards.new(@validator)
        end

        test "returns 0 when no rewards exist" do
          assert_equal 0.0, @compute.call
        end

        test "sums all rewards correctly" do
          create_reward(100)
          create_reward(200)
          create_reward(300)

          assert_equal 600.0, @compute.call
        end

        test "handles single reward" do
          create_reward(100)
          assert_equal 100.0, @compute.call
        end

        test "returns float value" do
          create_reward(100)
          assert_kind_of Float, @compute.call
        end

        test "class method produces same result as instance method" do
          create_reward(100)
          create_reward(200)

          assert_equal TotalRewards.new(@validator).call,
                       TotalRewards.call(@validator)
        end

        test "calculates rewards for specific validator only" do
          other_validator = Validator.create!(
            address: "0x" + "b" * 64,
            name: "Other Validator"
          )

          create_reward(100)
          create_reward(200, other_validator)

          assert_equal 100.0, TotalRewards.new(@validator).call
          assert_equal 200.0, TotalRewards.new(other_validator).call
        end

        test "handles large numbers" do
          create_reward(1_000_000)
          create_reward(2_000_000)

          assert_equal 3_000_000.0, @compute.call
        end

        test "handles decimal amounts" do
          create_reward(100.5)
          create_reward(200.7)

          assert_equal 301.2, @compute.call
        end

        private

        def create_reward(amount, validator = @validator)
          ValidatorReward.create!(
            validator_address: validator.address,
            amount: amount.to_s,
            block_height: rand(1_000_000),
            block_timestamp: Time.current.to_i.to_s,
            reward_datetime: Time.current,
            sequence: rand(1_000_000),
            version: rand(1_000_000)
          )
        end
      end
    end
  end
end