require "test_helper"

module Services
  module Analytics
    class NormalizerTest < ActiveSupport::TestCase
      # Test class to include the Normalizer module
      class DummyClass
        include Services::Analytics::Normalizer
      end

      setup do
        @dummy = DummyClass.new
      end

      # Class method tests
      test ".normalize_value handles normal case" do
        result = DummyClass.normalize_value(50, 0, 100)
        assert_equal 50.0, result
      end

      test ".normalize_value handles minimum value" do
        result = DummyClass.normalize_value(0, 0, 100)
        assert_equal 0.0, result
      end

      test ".normalize_value handles maximum value" do
        result = DummyClass.normalize_value(100, 0, 100)
        assert_equal 100.0, result
      end

      test ".normalize_value handles equal min and max" do
        result = DummyClass.normalize_value(50, 100, 100)
        assert_equal 0.0, result
      end

      test ".normalize_value handles negative numbers" do
        result = DummyClass.normalize_value(-50, -100, 0)
        assert_equal 50.0, result
      end

      test ".normalize_value handles decimal precision" do
        result = DummyClass.normalize_value(75, 0, 100)
        assert_equal result.round(2), result
      end

      # Date normalization class method tests
      test ".normalize_date handles normal case" do
        max_date = Date.new(2022, 1, 1)
        min_date = Date.new(2023, 1, 1)
        test_date = Date.new(2022, 7, 1)

        result = DummyClass.normalize_date(test_date, max_date, min_date)
        assert_includes 0..100, result
        assert_equal result.round(2), result
      end

      test ".normalize_date gives higher scores to older dates" do
        max_date = Date.new(2022, 1, 1)
        min_date = Date.new(2023, 1, 1)
        older_date = Date.new(2022, 3, 1)
        newer_date = Date.new(2022, 9, 1)

        older_score = DummyClass.normalize_date(older_date, max_date, min_date)
        newer_score = DummyClass.normalize_date(newer_date, max_date, min_date)

        assert_operator older_score, :>, newer_score
      end

      test ".normalize_date handles max date" do
        max_date = Date.new(2022, 1, 1)
        min_date = Date.new(2023, 1, 1)

        result = DummyClass.normalize_date(max_date, max_date, min_date)
        assert_equal 100.0, result
      end

      test ".normalize_date handles min date" do
        max_date = Date.new(2022, 1, 1)
        min_date = Date.new(2023, 1, 1)

        result = DummyClass.normalize_date(min_date, max_date, min_date)
        assert_equal 0.0, result
      end

      # Date parsing class method tests
      test ".parse_date handles valid date string" do
        result = DummyClass.parse_date("2023-01-01")
        assert_equal Date.new(2023, 1, 1), result
      end

      test ".parse_date returns today for invalid date" do
        result = DummyClass.parse_date("invalid date")
        assert_equal Date.today, result
      end

      test ".parse_date handles nil input" do
        result = DummyClass.parse_date(nil)
        assert_equal Date.today, result
      end

      # Instance method tests
      test "#normalize_value delegates to class method" do
        class_result = DummyClass.normalize_value(50, 0, 100)
        instance_result = @dummy.normalize_value(50, 0, 100)
        assert_equal class_result, instance_result
      end

      test "#normalize_date delegates to class method" do
        max_date = Date.new(2022, 1, 1)
        min_date = Date.new(2023, 1, 1)
        test_date = Date.new(2022, 7, 1)

        class_result = DummyClass.normalize_date(test_date, max_date, min_date)
        instance_result = @dummy.normalize_date(test_date, max_date, min_date)
        assert_equal class_result, instance_result
      end

      test "#parse_date delegates to class method" do
        class_result = DummyClass.parse_date("2023-01-01")
        instance_result = @dummy.parse_date("2023-01-01")
        assert_equal class_result, instance_result
      end

      # Edge cases and error handling
      test "handles floating point precision" do
        result = DummyClass.normalize_value(33.333333, 0, 100)
        assert_equal 2, result.to_s.split('.').last.length
      end

      test "handles very large numbers" do
        result = DummyClass.normalize_value(1_000_000, 0, 10_000_000)
        assert_equal 10.0, result
      end

      test "handles very small decimal numbers" do
        result = DummyClass.normalize_value(0.001, 0, 0.01)
        assert_equal 10.0, result
      end

      test "handles future dates" do
        max_date = Date.today
        min_date = Date.today + 365
        future_date = Date.today + 180

        result = DummyClass.normalize_date(future_date, max_date, min_date)
        assert_includes 0..100, result
      end
    end
  end
end