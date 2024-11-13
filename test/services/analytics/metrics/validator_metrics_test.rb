require "test_helper"

module Services
  module Analytics
    module Metrics
      class ValidatorMetricsTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator",
            lat: 40.7128,
            lng: -74.0060,
            voting_record: "80/100",
            last_epoch_perf: "3000",
            start_date: "2023-01-01",
            performance: 75.0
          )
          @metrics = ValidatorMetrics.new(@validator)
        end

        test "initializes with validator" do
          assert_equal @validator, @metrics.validator
        end

        test "calculates data center score" do
          score = @metrics.data_center_score
          assert_kind_of Numeric, score
          assert_includes 0..100, score
        end

        test "memoizes data center score" do
          first_call = @metrics.data_center_score
          # Modify validator location to ensure memoization
          @validator.update(lat: 0, lng: 0)
          second_call = @metrics.data_center_score

          assert_equal first_call, second_call
        end

        test "calculates voting record score" do
          score = @metrics.voting_record_score
          assert_kind_of Numeric, score
          assert_includes 0..100, score
        end

        test "memoizes voting record score" do
          first_call = @metrics.voting_record_score
          @validator.update(voting_record: "90/100")
          second_call = @metrics.voting_record_score

          assert_equal first_call, second_call
        end

        test "calculates last epoch score" do
          score = @metrics.last_epoch_score
          assert_kind_of Numeric, score
          assert_includes 0..100, score
        end

        test "memoizes last epoch score" do
          first_call = @metrics.last_epoch_score
          @validator.update(last_epoch_perf: "4000")
          second_call = @metrics.last_epoch_score

          assert_equal first_call, second_call
        end

        test "calculates start date score" do
          score = @metrics.start_date_score
          assert_kind_of Numeric, score
          assert_includes 0..100, score
        end

        test "memoizes start date score" do
          first_call = @metrics.start_date_score
          @validator.update(start_date: "2024-01-01")
          second_call = @metrics.start_date_score

          assert_equal first_call, second_call
        end

        test "calculates overall score" do
          score = @metrics.overall_score
          assert_kind_of Numeric, score
          assert_includes 0..100, score
        end

        test "memoizes overall score" do
          first_call = @metrics.overall_score
          @validator.update(performance: 100.0)
          second_call = @metrics.overall_score

          assert_equal first_call, second_call
        end

        test "calculates performance score" do
          score = @metrics.performance_score
          assert_kind_of Numeric, score
          assert_includes 0..100, score
        end

        test "memoizes performance score" do
          first_call = @metrics.performance_score
          # Update some performance-related data
          @validator.update(blocks_purposed_day: 2000)
          second_call = @metrics.performance_score

          assert_equal first_call, second_call
        end

        test "generates weekly performance metrics" do
          metrics = @metrics.weekly_performance_metrics
          assert_kind_of Array, metrics

          metrics.each do |metric|
            assert_includes metric.keys, :period
            assert_includes metric.keys, :metrics
            assert_kind_of Hash, metric[:metrics]
          end
        end

        test "respects weeks_back parameter" do
          weeks = 2
          metrics = @metrics.weekly_performance_metrics(weeks)
          assert_equal weeks + 1, metrics.length
        end

        test "APTOS_START_DATE is correctly set" do
          assert_equal Date.parse('2022-10-12'), ValidatorMetrics::APTOS_START_DATE
        end

        # Calculator initialization tests
        test "initializes distance calculator" do
          calculator = @metrics.send(:distance_calculator)
          assert_instance_of Calculators::DistanceCalculator, calculator
        end

        test "initializes score calculator" do
          calculator = @metrics.send(:score_calculator)
          assert_instance_of Calculators::ScoreCalculator, calculator
        end

        test "initializes performance calculator" do
          calculator = @metrics.send(:performance_calculator)
          assert_instance_of Calculators::PerformanceCalculator, calculator
        end

        test "memoizes calculators" do
          first_calculator = @metrics.send(:distance_calculator)
          second_calculator = @metrics.send(:distance_calculator)
          assert_same first_calculator, second_calculator
        end

        test "handles validator without performance score" do
          @validator.update(performance: nil)
          score = @metrics.overall_score
          assert_kind_of Numeric, score
          assert_includes 0..100, score
        end

        test "handles validator without data center score" do
          @validator.update(lat: nil, lng: nil)
          score = @metrics.overall_score
          assert_kind_of Numeric, score
          assert_includes 0..100, score
        end
      end
    end
  end
end