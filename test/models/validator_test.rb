require "test_helper"

class ValidatorTest < ActiveSupport::TestCase
  def setup
    @validator = Validator.new(
      address: "0x" + "a" * 64,
      name: "Test Validator",
      city: "New York",
      country: "United States",
      voting_record: "95 / 100",
      start_date: "2023-01-01",
      active_stake: "1000000",
      voting_power: "500000"
    )
  end

  # Association tests
  test "has many validator rewards" do
    assert_respond_to @validator, :validator_rewards
  end

  test "has many validator votes" do
    assert_respond_to @validator, :validator_votes
  end

  test "has many blocks" do
    assert_respond_to @validator, :blocks
  end

  test "has one attached avatar" do
    assert_respond_to @validator, :avatar
  end

  # Callback tests
  test "sets faker avatar url before create if blank" do
    @validator.avatar_url = nil
    @validator.save
    assert_not_nil @validator.avatar_url
    assert @validator.avatar_url.start_with?("https://")
  end

  test "preserves existing avatar url" do
    existing_url = "https://example.com/avatar.jpg"
    @validator.avatar_url = existing_url
    @validator.save
    assert_equal existing_url, @validator.avatar_url
  end

  test "initializes random block data after initialization" do
    validator = Validator.new
    assert_not_nil validator.blocks_purposed_day
    assert_not_nil validator.blocks_purposed_week
    assert_not_nil validator.blocks_purposed_month
  end

  test "block data calculations are consistent" do
    validator = Validator.new
    assert_in_delta validator.blocks_purposed_day * 7, validator.blocks_purposed_week, 0.1
    assert_in_delta validator.blocks_purposed_day * 30.44, validator.blocks_purposed_month, 0.1
  end

  # Location tests
  test "returns full location when both city and country are present" do
    assert_equal "New York, United States", @validator.location
  end

  test "returns only country when city is blank" do
    @validator.city = nil
    assert_equal "United States", @validator.location
  end

  test "returns empty string when both city and country are blank" do
    @validator.city = nil
    @validator.country = nil
    assert_equal "", @validator.location
  end

  # Voting record tests
  test "calculates correct voting record percentage" do
    @validator.voting_record = "95 / 100"
    assert_equal 95, @validator.voting_record_percent
  end

  test "handles zero denominator in voting record" do
    @validator.voting_record = "95 / 0"
    assert_equal 0, @validator.voting_record_percent
  end

  test "handles nil voting record" do
    @validator.voting_record = nil
    assert_equal 0, @validator.voting_record_percent
  end

  test "handles empty voting record" do
    @validator.voting_record = ""
    assert_equal 0, @validator.voting_record_percent
  end

  test "caps voting record percentage at 100" do
    @validator.voting_record = "110 / 100"
    assert_equal 100, @validator.voting_record_percent
  end

  # Start date score tests
  test "calculates start date score" do
    @validator.start_date = APTOS_START_DATE.to_s
    assert_instance_of Float, @validator.start_date_score
    assert_includes 0..100, @validator.start_date_score
  end

  test "gives higher score to older start dates" do
    older_validator = Validator.new(start_date: APTOS_START_DATE.to_s)
    newer_validator = Validator.new(start_date: Date.today.to_s)

    assert_operator older_validator.start_date_score, :>, newer_validator.start_date_score
  end

  # Network sharding tests
  test "uses correct table name for testnet" do
    Validator.use_network(:testnet)
    assert_equal "validators_testnet", Validator.table_name
  end

  test "uses correct table name for mainnet" do
    Validator.use_network(:mainnet)
    assert_equal "validators_mainnet", Validator.table_name
  end

  # Score calculation tests
  test "updates scores before save" do
    @validator.save
    assert_not_nil @validator.voting_record_score
    assert_not_nil @validator.last_epoch_score
    assert_not_nil @validator.overall_score
    assert_not_nil @validator.data_center_score
    assert_not_nil @validator.performance
  end

  test "scores are within valid range" do
    @validator.save
    scores = [
      @validator.voting_record_score,
      @validator.last_epoch_score,
      @validator.overall_score,
      @validator.data_center_score,
      @validator.performance
    ]

    scores.each do |score|
      assert_includes 0..100, score unless score.nil?
    end
  end

  # Pagination tests
  test "paginates with 10 records per page" do
    assert_equal 10, Validator.paginates_per
  end

  # Optional attributes tests
  test "allows scores attribute to be set" do
    scores_data = { performance: 95, voting: 90 }
    @validator.scores = scores_data
    assert_equal scores_data, @validator.scores
  end

  test "allows commission attribute to be set" do
    @validator.commission = 0.1
    assert_equal 0.1, @validator.commission
  end
end