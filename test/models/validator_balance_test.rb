require "test_helper"

class ValidatorBalanceTest < ActiveSupport::TestCase
  def setup
    @validator = Validator.create!(
      address: "0x" + "a" * 64,
      name: "Test Validator"
    )

    @validator_balance = ValidatorBalance.new(
      validator_address: @validator.address,
      total_balance: "1000000",
      staked_amount: "800000",
      available_amount: "200000",
      epoch: "100",
      version: 12345,
      recorded_at: Time.current
    )
  end

  test "valid validator balance" do
    assert @validator_balance.valid?
  end

  # Association tests
  test "belongs to validator" do
    assert_respond_to @validator_balance, :validator
    assert_equal @validator, @validator_balance.validator
  end

  test "allows nil validator" do
    @validator_balance.validator = nil
    assert @validator_balance.valid?
  end

  # Validation tests
  test "requires validator_address" do
    @validator_balance.validator_address = nil
    assert_not @validator_balance.valid?
    assert_includes @validator_balance.errors[:validator_address], "can't be blank"
  end

  test "requires total_balance" do
    @validator_balance.total_balance = nil
    assert_not @validator_balance.valid?
    assert_includes @validator_balance.errors[:total_balance], "can't be blank"
  end

  test "requires staked_amount" do
    @validator_balance.staked_amount = nil
    assert_not @validator_balance.valid?
    assert_includes @validator_balance.errors[:staked_amount], "can't be blank"
  end

  test "requires available_amount" do
    @validator_balance.available_amount = nil
    assert_not @validator_balance.valid?
    assert_includes @validator_balance.errors[:available_amount], "can't be blank"
  end

  test "requires epoch" do
    @validator_balance.epoch = nil
    assert_not @validator_balance.valid?
    assert_includes @validator_balance.errors[:epoch], "can't be blank"
  end

  test "requires version" do
    @validator_balance.version = nil
    assert_not @validator_balance.valid?
    assert_includes @validator_balance.errors[:version], "can't be blank"
  end

  test "requires recorded_at" do
    @validator_balance.recorded_at = nil
    assert_not @validator_balance.valid?
    assert_includes @validator_balance.errors[:recorded_at], "can't be blank"
  end

  # Scope tests
  test "recent scope orders by recorded_at desc" do
    older_balance = ValidatorBalance.create!(
      @validator_balance.attributes.merge(
        recorded_at: 1.day.ago,
        version: 12344
      )
    )
    newer_balance = ValidatorBalance.create!(
      @validator_balance.attributes.merge(
        recorded_at: Time.current,
        version: 12346
      )
    )

    recent_balances = ValidatorBalance.recent
    assert_equal newer_balance, recent_balances.first
    assert_equal older_balance, recent_balances.last
  end

  test "by_epoch scope filters by epoch" do
    balance1 = ValidatorBalance.create!(
      @validator_balance.attributes.merge(epoch: "100", version: 12344)
    )
    balance2 = ValidatorBalance.create!(
      @validator_balance.attributes.merge(epoch: "101", version: 12345)
    )

    epoch_100_balances = ValidatorBalance.by_epoch("100")
    assert_includes epoch_100_balances, balance1
    assert_not_includes epoch_100_balances, balance2
  end

  test "by_validator scope filters by validator address" do
    other_validator = Validator.create!(
      address: "0x" + "b" * 64,
      name: "Other Validator"
    )

    balance1 = ValidatorBalance.create!(
      @validator_balance.attributes.merge(version: 12344)
    )
    balance2 = ValidatorBalance.create!(
      @validator_balance.attributes.merge(
        validator_address: other_validator.address,
        version: 12345
      )
    )

    validator_balances = ValidatorBalance.by_validator(@validator.address)
    assert_includes validator_balances, balance1
    assert_not_includes validator_balances, balance2
  end

  # Network sharding tests
  test "uses correct table name for testnet" do
    ValidatorBalance.use_network(:testnet)
    assert_equal "validator_balances_testnet", ValidatorBalance.table_name
  end

  test "uses correct table name for mainnet" do
    ValidatorBalance.use_network(:mainnet)
    assert_equal "validator_balances_mainnet", ValidatorBalance.table_name
  end

  # Business logic tests
  test "available amount should be difference of total and staked" do
    total = 1_000_000
    staked = 800_000
    available = 200_000

    balance = ValidatorBalance.new(
      validator_address: @validator.address,
      total_balance: total.to_s,
      staked_amount: staked.to_s,
      available_amount: available.to_s,
      epoch: "100",
      version: 12345,
      recorded_at: Time.current
    )

    assert_equal total, balance.total_balance.to_i
    assert_equal staked, balance.staked_amount.to_i
    assert_equal available, balance.available_amount.to_i
    assert_equal balance.total_balance.to_i,
                 balance.staked_amount.to_i + balance.available_amount.to_i
  end

  test "recorded_at cannot be in the future" do
    @validator_balance.recorded_at = 1.day.from_now
    assert_not @validator_balance.valid?

    @validator_balance.recorded_at = Time.current
    assert @validator_balance.valid?

    @validator_balance.recorded_at = 1.day.ago
    assert @validator_balance.valid?
  end
end