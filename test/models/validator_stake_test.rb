require "test_helper"

class ValidatorStakeTest < ActiveSupport::TestCase
  def setup
    @validator = Validator.create!(
      address: "0x" + "a" * 64,
      name: "Test Validator"
    )

    @validator_stake = ValidatorStake.new(
      validator_address: @validator.address,
      amount: "1000000",
      epoch: "100",
      recorded_at: Time.current,
      version: 12345
    )
  end

  test "valid validator stake" do
    assert @validator_stake.valid?
  end

  # Association tests
  test "belongs to validator" do
    assert_respond_to @validator_stake, :validator
    assert_equal @validator, @validator_stake.validator
  end

  test "allows nil validator" do
    @validator_stake.validator = nil
    assert @validator_stake.valid?
  end

  # Scope tests
  test "recent scope orders by recorded_at desc" do
    older_stake = ValidatorStake.create!(
      @validator_stake.attributes.merge(
        recorded_at: 1.day.ago,
        version: 12344
      )
    )
    newer_stake = ValidatorStake.create!(
      @validator_stake.attributes.merge(
        recorded_at: Time.current,
        version: 12346
      )
    )

    recent_stakes = ValidatorStake.recent
    assert_equal newer_stake, recent_stakes.first
    assert_equal older_stake, recent_stakes.last
  end

  # Uniqueness test for combined index
  test "enforces uniqueness of validator_address and version combination" do
    @validator_stake.save!

    duplicate_stake = ValidatorStake.new(@validator_stake.attributes)
    assert_not duplicate_stake.valid?
    assert_raises(ActiveRecord::RecordNotUnique) { duplicate_stake.save!(validate: false) }

    # Different version should be valid
    duplicate_stake.version = @validator_stake.version + 1
    assert duplicate_stake.valid?

    # Different validator_address should be valid
    different_validator = ValidatorStake.new(
      @validator_stake.attributes.merge(
        validator_address: "0x" + "b" * 64,
        version: @validator_stake.version
      )
    )
    assert different_validator.valid?
  end

  # Network sharding tests
  test "uses correct table name for testnet" do
    ValidatorStake.use_network(:testnet)
    assert_equal "validator_stakes_testnet", ValidatorStake.table_name
  end

  test "uses correct table name for mainnet" do
    ValidatorStake.use_network(:mainnet)
    assert_equal "validator_stakes_mainnet", ValidatorStake.table_name
  end

  # Field validation tests
  test "requires amount" do
    @validator_stake.amount = nil
    assert_not @validator_stake.valid?
    assert_includes @validator_stake.errors[:amount], "can't be blank"
  end

  test "requires epoch" do
    @validator_stake.epoch = nil
    assert_not @validator_stake.valid?
    assert_includes @validator_stake.errors[:epoch], "can't be blank"
  end

  test "requires recorded_at" do
    @validator_stake.recorded_at = nil
    assert_not @validator_stake.valid?
    assert_includes @validator_stake.errors[:recorded_at], "can't be blank"
  end

  test "requires validator_address" do
    @validator_stake.validator_address = nil
    assert_not @validator_stake.valid?
    assert_includes @validator_stake.errors[:validator_address], "can't be blank"
  end

  test "requires version" do
    @validator_stake.version = nil
    assert_not @validator_stake.valid?
    assert_includes @validator_stake.errors[:version], "can't be blank"
  end

  # Data integrity tests
  test "version should be a positive integer" do
    @validator_stake.version = -1
    assert_not @validator_stake.valid?

    @validator_stake.version = 0
    assert_not @validator_stake.valid?

    @validator_stake.version = 1
    assert @validator_stake.valid?
  end

  test "amount should be a valid numerical string" do
    @validator_stake.amount = "invalid"
    assert_not @validator_stake.valid?

    @validator_stake.amount = "-1000"
    assert_not @validator_stake.valid?

    @validator_stake.amount = "1000"
    assert @validator_stake.valid?
  end

  test "epoch should be a valid numerical string" do
    @validator_stake.epoch = "invalid"
    assert_not @validator_stake.valid?

    @validator_stake.epoch = "-1"
    assert_not @validator_stake.valid?

    @validator_stake.epoch = "100"
    assert @validator_stake.valid?
  end

  test "recorded_at should not be in the future" do
    @validator_stake.recorded_at = 1.day.from_now
    assert_not @validator_stake.valid?

    @validator_stake.recorded_at = Time.current
    assert @validator_stake.valid?

    @validator_stake.recorded_at = 1.day.ago
    assert @validator_stake.valid?
  end

  # Index presence tests
  test "can query efficiently by epoch" do
    assert_equal 1, ActiveRecord::Base.connection.indexes('validator_stakes_testnet')
                                      .count { |i| i.columns == ['epoch'] }
  end

  test "can query efficiently by recorded_at" do
    assert_equal 1, ActiveRecord::Base.connection.indexes('validator_stakes_testnet')
                                      .count { |i| i.columns == ['recorded_at'] }
  end

  test "can query efficiently by validator_address" do
    assert_equal 1, ActiveRecord::Base.connection.indexes('validator_stakes_testnet')
                                      .count { |i| i.columns == ['validator_address'] }
  end

  test "can query efficiently by version" do
    assert_equal 1, ActiveRecord::Base.connection.indexes('validator_stakes_testnet')
                                      .count { |i| i.columns == ['version'] }
  end

  # Composite index test
  test "has unique composite index on validator_address and version" do
    composite_indexes = ActiveRecord::Base.connection.indexes('validator_stakes_testnet')
                                          .select { |i| i.columns == ['validator_address', 'version'] }

    assert_equal 1, composite_indexes.count
    assert composite_indexes.first.unique
  end
end