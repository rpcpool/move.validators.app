require "test_helper"

class EpochTest < ActiveSupport::TestCase
  def setup
    @epoch = Epoch.new(
      epoch: 100,
      slots_in_epoch: 1000,
      starting_slot: 100000,
      total_rewards: 1000000,
      total_stake: 5000000,
      avg_validator_staked: 50000
    )
  end

  test "valid epoch" do
    assert @epoch.valid?
  end

  # Virtual attribute tests
  test "has active_validators virtual attribute" do
    assert_respond_to @epoch, :active_validators
    assert_respond_to @epoch, :active_validators=
  end

  test "can set and get active_validators" do
    active_validators = 100
    @epoch.active_validators = active_validators
    assert_equal active_validators, @epoch.active_validators
  end

  test "active_validators doesn't persist to database" do
    @epoch.active_validators = 100
    @epoch.save!

    reloaded_epoch = Epoch.find(@epoch.id)
    assert_nil reloaded_epoch.active_validators
  end

  # Uniqueness test
  test "enforces uniqueness of epoch number" do
    @epoch.save!

    duplicate_epoch = Epoch.new(@epoch.attributes)
    assert_not duplicate_epoch.valid?
    assert_raises(ActiveRecord::RecordNotUnique) { duplicate_epoch.save!(validate: false) }
  end

  # Network sharding tests
  test "uses correct table name for testnet" do
    Epoch.use_network(:testnet)
    assert_equal "epochs_testnet", Epoch.table_name
  end

  test "uses correct table name for mainnet" do
    Epoch.use_network(:mainnet)
    assert_equal "epochs_mainnet", Epoch.table_name
  end

  # Field validation tests
  test "requires epoch number" do
    @epoch.epoch = nil
    assert_not @epoch.valid?
    assert_includes @epoch.errors[:epoch], "can't be blank"
  end

  # Data integrity tests
  test "epoch number should be a non-negative integer" do
    @epoch.epoch = -1
    assert_not @epoch.valid?

    @epoch.epoch = 0
    assert @epoch.valid?

    @epoch.epoch = 1
    assert @epoch.valid?
  end

  test "slots_in_epoch should be a positive integer" do
    @epoch.slots_in_epoch = -1
    assert_not @epoch.valid?

    @epoch.slots_in_epoch = 0
    assert_not @epoch.valid?

    @epoch.slots_in_epoch = 1
    assert @epoch.valid?
  end

  test "starting_slot should be a non-negative integer" do
    @epoch.starting_slot = -1
    assert_not @epoch.valid?

    @epoch.starting_slot = 0
    assert @epoch.valid?

    @epoch.starting_slot = 1
    assert @epoch.valid?
  end

  test "total_rewards should be a non-negative integer" do
    @epoch.total_rewards = -1
    assert_not @epoch.valid?

    @epoch.total_rewards = 0
    assert @epoch.valid?

    @epoch.total_rewards = 1
    assert @epoch.valid?
  end

  test "total_stake should be a non-negative integer" do
    @epoch.total_stake = -1
    assert_not @epoch.valid?

    @epoch.total_stake = 0
    assert @epoch.valid?

    @epoch.total_stake = 1
    assert @epoch.valid?
  end

  test "avg_validator_staked should be a non-negative integer" do
    @epoch.avg_validator_staked = -1
    assert_not @epoch.valid?

    @epoch.avg_validator_staked = 0
    assert @epoch.valid?

    @epoch.avg_validator_staked = 1
    assert @epoch.valid?
  end

  # Index tests
  test "has unique index on epoch" do
    indexes = ActiveRecord::Base.connection.indexes('epochs_testnet')
    epoch_index = indexes.find { |i| i.columns == ['epoch'] }

    assert_not_nil epoch_index
    assert epoch_index.unique
  end

  # Calculation tests
  test "can calculate average stake per validator" do
    @epoch.total_stake = 1000000
    @epoch.active_validators = 10

    expected_avg = @epoch.total_stake / @epoch.active_validators
    assert_equal expected_avg, @epoch.avg_validator_staked
  end

  test "handles epoch transitions" do
    previous_epoch = Epoch.create!(
      epoch: 99,
      slots_in_epoch: 1000,
      starting_slot: 99000,
      total_rewards: 900000,
      total_stake: 4500000,
      avg_validator_staked: 45000
    )

    current_epoch = @epoch

    assert_equal previous_epoch.epoch + 1, current_epoch.epoch
    assert_equal previous_epoch.starting_slot + previous_epoch.slots_in_epoch, current_epoch.starting_slot
  end

  # Optional fields tests
  test "allows nil values for optional fields" do
    optional_fields = %i[
      avg_validator_staked
      slots_in_epoch
      total_rewards
      total_stake
    ]

    optional_fields.each do |field|
      @epoch[field] = nil
      assert @epoch.valid?, "#{field} should be optional"
    end
  end
end