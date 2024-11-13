require "test_helper"

class ValidatorRewardTest < ActiveSupport::TestCase
  def setup
    @validator = Validator.create!(
      address: "0x" + "a" * 64,
      name: "Test Validator"
    )

    @validator_reward = ValidatorReward.new(
      validator_address: @validator.address,
      amount: "1000000",
      block_height: 12345,
      block_timestamp: Time.current.to_i.to_s,
      reward_datetime: Time.current,
      sequence: 1,
      version: 67890
    )
  end

  test "valid validator reward" do
    assert @validator_reward.valid?
  end

  # Association tests
  test "belongs to validator" do
    assert_respond_to @validator_reward, :validator
    assert_equal @validator, @validator_reward.validator
  end

  test "allows nil validator" do
    @validator_reward.validator = nil
    assert @validator_reward.valid?
  end

  # Scope tests
  test "recent scope orders by reward_datetime desc" do
    older_reward = ValidatorReward.create!(
      @validator_reward.attributes.merge(
        reward_datetime: 1.day.ago,
        version: 67889,
        sequence: 1
      )
    )
    newer_reward = ValidatorReward.create!(
      @validator_reward.attributes.merge(
        reward_datetime: Time.current,
        version: 67891,
        sequence: 2
      )
    )

    recent_rewards = ValidatorReward.recent
    assert_equal newer_reward, recent_rewards.first
    assert_equal older_reward, recent_rewards.last
  end

  # Uniqueness test for combined index
  test "enforces uniqueness of validator_address and version combination" do
    @validator_reward.save!

    duplicate_reward = ValidatorReward.new(@validator_reward.attributes)
    assert_not duplicate_reward.valid?
    assert_raises(ActiveRecord::RecordNotUnique) { duplicate_reward.save!(validate: false) }

    # Different version should be valid
    duplicate_reward.version = @validator_reward.version + 1
    assert duplicate_reward.valid?

    # Different validator_address should be valid
    different_validator = ValidatorReward.new(
      @validator_reward.attributes.merge(
        validator_address: "0x" + "b" * 64,
        version: @validator_reward.version
      )
    )
    assert different_validator.valid?
  end

  # Network sharding tests
  test "uses correct table name for testnet" do
    ValidatorReward.use_network(:testnet)
    assert_equal "validator_rewards_testnet", ValidatorReward.table_name
  end

  test "uses correct table name for mainnet" do
    ValidatorReward.use_network(:mainnet)
    assert_equal "validator_rewards_mainnet", ValidatorReward.table_name
  end

  # Field validation tests
  test "requires amount" do
    @validator_reward.amount = nil
    assert_not @validator_reward.valid?
    assert_includes @validator_reward.errors[:amount], "can't be blank"
  end

  test "requires block_height" do
    @validator_reward.block_height = nil
    assert_not @validator_reward.valid?
    assert_includes @validator_reward.errors[:block_height], "can't be blank"
  end

  test "requires block_timestamp" do
    @validator_reward.block_timestamp = nil
    assert_not @validator_reward.valid?
    assert_includes @validator_reward.errors[:block_timestamp], "can't be blank"
  end

  test "requires reward_datetime" do
    @validator_reward.reward_datetime = nil
    assert_not @validator_reward.valid?
    assert_includes @validator_reward.errors[:reward_datetime], "can't be blank"
  end

  test "requires sequence" do
    @validator_reward.sequence = nil
    assert_not @validator_reward.valid?
    assert_includes @validator_reward.errors[:sequence], "can't be blank"
  end

  test "requires validator_address" do
    @validator_reward.validator_address = nil
    assert_not @validator_reward.valid?
    assert_includes @validator_reward.errors[:validator_address], "can't be blank"
  end

  test "requires version" do
    @validator_reward.version = nil
    assert_not @validator_reward.valid?
    assert_includes @validator_reward.errors[:version], "can't be blank"
  end

  # Data integrity tests
  test "block_height should be a positive integer" do
    @validator_reward.block_height = -1
    assert_not @validator_reward.valid?

    @validator_reward.block_height = 0
    assert_not @validator_reward.valid?

    @validator_reward.block_height = 1
    assert @validator_reward.valid?
  end

  test "version should be a positive integer" do
    @validator_reward.version = -1
    assert_not @validator_reward.valid?

    @validator_reward.version = 0
    assert_not @validator_reward.valid?

    @validator_reward.version = 1
    assert @validator_reward.valid?
  end

  test "sequence should be a positive integer" do
    @validator_reward.sequence = -1
    assert_not @validator_reward.valid?

    @validator_reward.sequence = 0
    assert_not @validator_reward.valid?

    @validator_reward.sequence = 1
    assert @validator_reward.valid?
  end

  test "reward_datetime should not be in the future" do
    @validator_reward.reward_datetime = 1.day.from_now
    assert_not @validator_reward.valid?

    @validator_reward.reward_datetime = Time.current
    assert @validator_reward.valid?

    @validator_reward.reward_datetime = 1.day.ago
    assert @validator_reward.valid?
  end

  test "amount should be a valid numerical string" do
    @validator_reward.amount = "invalid"
    assert_not @validator_reward.valid?

    @validator_reward.amount = "-1000"
    assert_not @validator_reward.valid?

    @validator_reward.amount = "1000"
    assert @validator_reward.valid?
  end
end