require "test_helper"

module Services
  module Analytics
    module Calculators
      class ScoreCalculatorTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator",
            voting_record: "95/100",
            last_epoch_perf: "3000",
            start_date: "2023-01-01",
            performance: 80.0,
            data_center_score: 75.0
          )
          @calculator = ScoreCalculator.new(@validator)
        end

        # Voting Record Score Tests
        test "calculates correct voting record score" do
          assert_equal 95.0, @calculator.calculate_voting_record_score
        end

        test "returns 0 for nil voting record" do
          @validator.voting_record = nil
          assert_equal 0, @calculator.calculate_voting_record_score
        end

        test "returns 0 for empty voting record" do
          @validator.voting_record = ""
          assert_equal 0, @calculator.calculate_voting_record_score
        end

        test "returns 0 for invalid voting record format" do
          @validator.voting_record = "invalid"
          assert_equal 0, @calculator.calculate_voting_record_score
        end

        test "returns 0 for zero total votes" do
          @validator.voting_record = "10/0"
          assert_equal 0, @calculator.calculate_voting_record_score
        end

        # Last Epoch Score Tests
        test "calculates last epoch score for established validator" do
          @validator.start_date = (Date.today - 400).to_s
          @validator.last_epoch_perf = "3000"
          score = @calculator.calculate_last_epoch_score
          assert_includes 0..100, score
        end

        test "calculates reduced score for new validator" do
          @validator.start_date = (Date.today - 30).to_s
          @validator.last_epoch_perf = "3000"
          new_score = @calculator.calculate_last_epoch_score

          @validator.start_date = (Date.today - 365).to_s
          old_score = @calculator.calculate_last_epoch_score

          assert_operator new_score, :<, old_score
        end

        test "returns 0 for nil last_epoch_perf" do
          @validator.last_epoch_perf = nil
          assert_equal 0, @calculator.calculate_last_epoch_score
        end

        test "returns 0 for zero last_epoch_perf" do
          @validator.last_epoch_perf = "0"
          assert_equal 0, @calculator.calculate_last_epoch_score
        end

        test "handles string last_epoch_perf" do
          @validator.last_epoch_perf = "2000"
          assert_kind_of Numeric, @calculator.calculate_last_epoch_score
        end

        # Overall Score Tests
        test "calculates overall score with all components" do
          score = @calculator.calculate_overall_score
          assert_includes 0..100, score
        end

        test "weights components equally" do
          @validator.update(
            voting_record: "100/100", # 100 score
            last_epoch_perf: "4000", # 100 score
            performance: 100.0, # 100 score
            data_center_score: 100.0 # 100 score
          )

          assert_equal 100.0, @calculator.calculate_overall_score
        end

        test "handles missing components" do
          score = @calculator.calculate_overall_score(
            performance_score: nil,
            data_center_score: nil
          )
          assert_includes 0..100, score
        end

        test "rounds overall score to two decimals" do
          score = @calculator.calculate_overall_score
          assert_equal score.round(2), score
        end

        # Start Date Score Tests
        test "calculates start date score" do
          score = @calculator.calculate_start_date_score
          assert_includes 0..100, score
        end

        test "gives higher score to older start dates" do
          @validator.start_date = ValidatorMetrics::APTOS_START_DATE.to_s
          old_score = @calculator.calculate_start_date_score

          @validator.start_date = Date.today.to_s
          new_score = @calculator.calculate_start_date_score

          assert_operator old_score, :>, new_score
        end

        test "handles invalid start date" do
          @validator.start_date = "invalid"
          assert_nothing_raised do
            score = @calculator.calculate_start_date_score
            assert_includes 0..100, score
          end
        end

        test "clamps dates outside valid range" do
          @validator.start_date = (ValidatorMetrics::APTOS_START_DATE - 1.year).to_s
          early_score = @calculator.calculate_start_date_score

          @validator.start_date = ValidatorMetrics::APTOS_START_DATE.to_s
          valid_score = @calculator.calculate_start_date_score

          assert_equal valid_score, early_score
        end
      end
    end
  end
end