require "test_helper"

module Services
  module Analytics
    module Calculators
      class PerformanceCalculatorTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator",
            blocks_purposed_day: 1000,
            blocks_purposed_week: 7000,
            blocks_purposed_month: 30440
          )

          @calculator = PerformanceCalculator.new(@validator)
        end

        # Performance Score Calculation Tests
        test "calculates performance score within expected range" do
          score = @calculator.calculate_performance_score
          assert_includes 0..100, score
        end

        test "calculates performance score with single validator" do
          score = @calculator.calculate_performance_score
          assert_equal 0, score # Should be 0 when only one validator exists
        end

        test "calculates relative performance with multiple validators" do
          # Create validators with different performance levels
          low_performer = Validator.create!(
            address: "0x" + "b" * 64,
            name: "Low Performer",
            blocks_purposed_day: 800,
            blocks_purposed_week: 5600,
            blocks_purposed_month: 24352
          )

          high_performer = Validator.create!(
            address: "0x" + "c" * 64,
            name: "High Performer",
            blocks_purposed_day: 2000,
            blocks_purposed_week: 14000,
            blocks_purposed_month: 60880
          )

          # Calculate scores for all validators
          low_score = PerformanceCalculator.new(low_performer).calculate_performance_score
          mid_score = @calculator.calculate_performance_score
          high_score = PerformanceCalculator.new(high_performer).calculate_performance_score

          # Verify relative ordering
          assert_operator low_score, :<, mid_score
          assert_operator mid_score, :<, high_score
        end

        test "handles zero values" do
          zero_performer = Validator.create!(
            address: "0x" + "d" * 64,
            name: "Zero Performer",
            blocks_purposed_day: 0,
            blocks_purposed_week: 0,
            blocks_purposed_month: 0
          )

          score = PerformanceCalculator.new(zero_performer).calculate_performance_score
          assert_equal 0, score
        end

        # Weekly Performance Metrics Tests
        test "generates correct number of weeks" do
          weeks_back = 3
          metrics = @calculator.weekly_performance_metrics(weeks_back)
          assert_equal weeks_back + 1, metrics.length
        end

        test "orders weekly metrics from oldest to newest" do
          metrics = @calculator.weekly_performance_metrics(2)
          periods = metrics.map { |m| m[:period] }
          assert_equal ["2w ago", "1w ago", "This Week"], periods
        end

        test "includes required metrics in weekly data" do
          metrics = @calculator.weekly_performance_metrics(1).first
          assert_includes metrics[:metrics].keys, :overall_score
          assert_includes metrics[:metrics].keys, :block_performance
          assert_includes metrics[:metrics].keys, :rewards_growth
        end

        test "calculates correct block counts for period" do
          start_date = Date.today
          end_date = start_date + 7

          blocks = @calculator.send(:blocks_for_period, start_date, end_date)

          assert_equal @validator.blocks_purposed_day, blocks[:day]
          assert_equal @validator.blocks_purposed_day * 7, blocks[:week]
          assert_in_delta @validator.blocks_purposed_day * 30.44, blocks[:month], 0.01
        end

        # Normalization Tests
        test "normalizes values correctly in performance calculation" do
          # Create validators with min and max values
          min_validator = Validator.create!(
            address: "0x" + "e" * 64,
            name: "Min Performer",
            blocks_purposed_day: 800,
            blocks_purposed_week: 5600,
            blocks_purposed_month: 24352
          )

          max_validator = Validator.create!(
            address: "0x" + "f" * 64,
            name: "Max Performer",
            blocks_purposed_day: 2000,
            blocks_purposed_week: 14000,
            blocks_purposed_month: 60880
          )

          min_score = PerformanceCalculator.new(min_validator).calculate_performance_score
          max_score = PerformanceCalculator.new(max_validator).calculate_performance_score

          assert_equal 0, min_score
          assert_equal 100, max_score
        end

        # Period Metrics Tests
        test "calculates period metrics correctly" do
          start_date = Date.today
          end_date = start_date + 7

          metrics = @calculator.send(:calculate_period_metrics, start_date, end_date)

          assert_kind_of Numeric, metrics[:overall_score]
          assert_kind_of Numeric, metrics[:block_performance]
          assert_kind_of Numeric, metrics[:rewards_growth]

          assert_includes 0..100, metrics[:overall_score]
          assert_includes 0..100, metrics[:block_performance]
        end

        test "handles metric calculation for different period lengths" do
          # Test for 1 day
          day_metrics = @calculator.send(:calculate_period_metrics, Date.today, Date.today + 1)
          assert day_metrics[:block_performance] >= 0

          # Test for 1 week
          week_metrics = @calculator.send(:calculate_period_metrics, Date.today, Date.today + 7)
          assert week_metrics[:block_performance] >= 0

          # Test for 1 month
          month_metrics = @calculator.send(:calculate_period_metrics, Date.today, Date.today + 30)
          assert month_metrics[:block_performance] >= 0
        end

        # Weighted Score Tests
        test "applies correct weights in performance calculation" do
          # Create a validator with equal values for all periods
          equal_validator = Validator.create!(
            address: "0x" + "g" * 64,
            name: "Equal Performer",
            blocks_purposed_day: 1000,
            blocks_purposed_week: 7000, # 1000 * 7
            blocks_purposed_month: 30440 # 1000 * 30.44
          )

          calculator = PerformanceCalculator.new(equal_validator)
          score = calculator.calculate_performance_score

          # Since all normalized values would be the same (let's call it X),
          # the final score should be: (0.4 * X) + (0.3 * X) + (0.3 * X) = X
          # Therefore, with equal inputs, the weighted score should equal any of the normalized values
          normalized_daily = calculator.send(:normalize_value, 1000, 800, 2000)
          assert_in_delta score, normalized_daily, 0.01
        end

        # Edge Cases
        test "handles missing reward data" do
          metrics = @calculator.weekly_performance_metrics(1)
          assert_kind_of Array, metrics
          assert_kind_of Hash, metrics.first
        end

        test "handles future dates" do
          metrics = @calculator.send(:calculate_period_metrics, Date.today + 1, Date.today + 8)
          assert_kind_of Hash, metrics
        end

        test "handles invalid weeks_back parameter" do
          assert_nothing_raised do
            metrics = @calculator.weekly_performance_metrics(-1)
            assert_kind_of Array, metrics
          end
        end
      end
    end
  end
end