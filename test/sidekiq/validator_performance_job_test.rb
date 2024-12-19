require "test_helper"

class ValidatorPerformanceJobTest < ActiveSupport::TestCase
  def setup
    @validator = validators(:one)
    @epoch_history = epoch_histories(:one)
    @valid_performance_data = {
      "epoch" => @epoch_history.epoch.to_s,
      "performances" => [
        {
          "validator_address" => @validator.address,
          "voting_power" => "100",
          "successful_proposals" => 5,
          "total_proposals" => 6,
          "epoch" => @epoch_history.epoch.to_s
        }
      ]
    }
    @job = ValidatorPerformanceJob.new
  end

  test "processes valid performance data" do
    assert_difference "ValidatorPerformance.count", 1 do
      @job.perform(@valid_performance_data)
    end

    performance = ValidatorPerformance.last
    assert_equal @validator.id, performance.send("validators_#{network}_id")
    assert_equal @epoch_history.id, performance.send("epoch_histories_#{network}_id")
    assert_equal 5, performance.successful_proposals
    assert_equal 6, performance.total_proposals
    assert_equal "100", performance.voting_power
    assert_equal 83.33, performance.performance_score # (5/6 * 100).round(2)
  end

  test "updates existing performance data" do
    # Create initial performance
    @job.perform(@valid_performance_data)
    initial_performance = ValidatorPerformance.last
    
    # Update with new data
    updated_data = @valid_performance_data.dup
    updated_data["performances"][0]["successful_proposals"] = 6
    updated_data["performances"][0]["total_proposals"] = 7

    assert_no_difference "ValidatorPerformance.count" do
      @job.perform(updated_data)
    end

    performance = ValidatorPerformance.find(initial_performance.id)
    assert_equal 6, performance.successful_proposals
    assert_equal 7, performance.total_proposals
    assert_equal 85.71, performance.performance_score # (6/7 * 100).round(2)
  end

  test "validates required fields" do
    # Test missing epoch
    invalid_data = @valid_performance_data.except("epoch")
    assert_no_difference "ValidatorPerformance.count" do
      @job.perform(invalid_data)
    end

    # Test missing performances
    invalid_data = @valid_performance_data.except("performances")
    assert_no_difference "ValidatorPerformance.count" do
      @job.perform(invalid_data)
    end
  end

  test "validates performance data structure" do
    invalid_performance = @valid_performance_data.dup
    invalid_performance["performances"][0].delete("validator_address")

    assert_no_difference "ValidatorPerformance.count" do
      @job.perform(invalid_performance)
    end
  end

  test "handles missing validator gracefully" do
    invalid_data = @valid_performance_data.dup
    invalid_data["performances"][0]["validator_address"] = "0xnonexistent"

    assert_no_difference "ValidatorPerformance.count" do
      @job.perform(invalid_data)
    end
  end

  test "handles missing epoch history gracefully" do
    invalid_data = @valid_performance_data.dup
    invalid_data["epoch"] = "999999"

    assert_no_difference "ValidatorPerformance.count" do
      @job.perform(invalid_data)
    end
  end

  test "calculates performance score correctly" do
    test_cases = [
      { successful: 5, total: 10, expected: 50.00 },
      { successful: 0, total: 5, expected: 0.00 },
      { successful: 10, total: 10, expected: 100.00 },
      { successful: 3, total: 7, expected: 42.86 }
    ]

    test_cases.each do |test_case|
      performance_data = @valid_performance_data.dup
      performance_data["performances"][0]["successful_proposals"] = test_case[:successful]
      performance_data["performances"][0]["total_proposals"] = test_case[:total]

      @job.perform(performance_data)
      performance = ValidatorPerformance.last

      assert_equal test_case[:expected], performance.performance_score,
        "Expected #{test_case[:successful]}/#{test_case[:total]} to give score of #{test_case[:expected]}"
    end
  end

  test "handles zero total proposals gracefully" do
    performance_data = @valid_performance_data.dup
    performance_data["performances"][0]["successful_proposals"] = 0
    performance_data["performances"][0]["total_proposals"] = 0

    @job.perform(performance_data)
    performance = ValidatorPerformance.last

    assert_equal 0.0, performance.performance_score
  end

  test "updates validator performance score" do
    @job.perform(@valid_performance_data)
    @validator.reload

    assert_equal 83.33, @validator.performance,
      "Should update validator's performance score"
  end

  test "handles database errors gracefully" do
    error_messages = []
    Rails.logger.stub :error, ->(msg) { error_messages << msg } do
      ValidatorPerformance.stub :upsert, ->(*) { raise ActiveRecord::StatementInvalid.new("Database error") } do
        @job.perform(@valid_performance_data)
      end
    end

    assert_match /Error processing performance for validator/, error_messages.first
    assert_match /Database error/, error_messages.first
  end

  test "respects network sharding" do
    assert_equal "validator_performances_testnet", ValidatorPerformance.table_name,
      "Should use the correct sharded table name"
  end

  test "processes multiple performances in single job" do
    # Create another validator
    second_validator = validators(:two)
    
    multi_performance_data = @valid_performance_data.dup
    multi_performance_data["performances"] << {
      "validator_address" => second_validator.address,
      "voting_power" => "200",
      "successful_proposals" => 8,
      "total_proposals" => 10,
      "epoch" => @epoch_history.epoch.to_s
    }

    assert_difference "ValidatorPerformance.count", 2 do
      @job.perform(multi_performance_data)
    end

    performances = ValidatorPerformance.order(:validator_address)
    assert_equal 2, performances.size
    assert_equal [83.33, 80.0], performances.map(&:performance_score)
  end

  private

  def network
    "testnet" # Adjust based on your test environment
  end
end
