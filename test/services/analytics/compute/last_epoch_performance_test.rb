require "test_helper"

module Services
  module Analytics
    module Compute
      class LastEpochPerformanceTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator",
            start_date: Time.current.to_s
          )

          @compute = LastEpochPerformance.new(@validator)
        end

        # Basic Functionality Tests
        test "returns 0 when no epochs exist" do
          assert_equal 0.0, @compute.call
        end

        test "returns 0 when no blocks exist in last epoch" do
          create_block(epoch: 2)
          assert_equal 0.0, @compute.call
        end

        test "calculates basic performance score" do
          # Create total of 10 blocks in last epoch, 5 from our validator
          create_blocks(5, epoch: 1, validator: @validator)
          create_blocks(5, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2) # Current epoch

          assert_equal 50.0, @compute.call
        end

        # Age Factor Tests
        test "applies age factor for validator less than one year old" do
          @validator.update(start_date: 6.months.ago.to_s)

          create_blocks(10, epoch: 1, validator: @validator)
          create_blocks(10, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          expected_score = 50.0 # (10/20 * 100) * (180/365)
          assert_in_delta expected_score, @compute.call, 1.0
        end

        test "does not apply age factor for validator more than one year old" do
          @validator.update(start_date: 2.years.ago.to_s)

          create_blocks(8, epoch: 1, validator: @validator)
          create_blocks(2, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          assert_equal 80.0, @compute.call
        end

        test "handles missing start date" do
          @validator.update(start_date: nil)

          create_blocks(5, epoch: 1, validator: @validator)
          create_blocks(5, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          assert_equal 0.0, @compute.call
        end

        # Score Clamping Tests
        test "clamps score to 100 maximum" do
          @validator.update(start_date: 2.years.ago.to_s)

          create_blocks(11, epoch: 1, validator: @validator)
          create_blocks(1, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          assert_equal 100.0, @compute.call
        end

        test "clamps score to 0 minimum" do
          @validator.update(start_date: 1.day.ago.to_s)

          create_blocks(1, epoch: 1, validator: @validator)
          create_blocks(99, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          score = @compute.call
          assert_operator score, :>=, 0
        end

        # Edge Cases
        test "handles zero blocks from validator" do
          create_blocks(10, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          assert_equal 0.0, @compute.call
        end

        test "handles future start date" do
          @validator.update(start_date: 1.day.from_now.to_s)

          create_blocks(5, epoch: 1, validator: @validator)
          create_blocks(5, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          assert_equal 0.0, @compute.call
        end

        test "calculates correctly with multiple validators" do
          create_blocks(6, epoch: 1, validator: @validator)
          create_blocks(2, epoch: 1, validator: create_other_validator)
          create_blocks(2, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          assert_equal 60.0, @compute.call
        end

        test "class method works the same as instance method" do
          create_blocks(5, epoch: 1, validator: @validator)
          create_blocks(5, epoch: 1, validator: create_other_validator)
          create_block(epoch: 2)

          assert_equal LastEpochPerformance.new(@validator).call,
                       LastEpochPerformance.call(@validator)
        end

        private

        def create_block(epoch:, validator: nil)
          Block.create!(
            validator_address: validator&.address || "0x" + "f" * 64,
            block_height: rand(1_000_000),
            block_hash: "0x" + SecureRandom.hex(32),
            block_timestamp: Time.current,
            first_version: rand(1_000_000),
            last_version: rand(1_000_000),
            epoch: epoch
          )
        end

        def create_blocks(count, epoch:, validator:)
          count.times { create_block(epoch: epoch, validator: validator) }
        end

        def create_other_validator
          Validator.create!(
            address: "0x" + SecureRandom.hex(32),
            name: "Other Validator",
            start_date: Time.current.to_s
          )
        end
      end
    end
  end
end