require "test_helper"

class BlockTest < ActiveSupport::TestCase
  def setup
    @block = Block.new(
      block_height: 12345,
      block_hash: "0x" + "a" * 64,
      block_timestamp: Time.current,
      first_version: 1000,
      last_version: 1100,
      validator_address: "0x" + "b" * 64
    )
  end

  test "valid block" do
    assert @block.valid?
  end

  test "has many transactions" do
    assert_respond_to @block, :transactions
    assert_kind_of ActiveRecord::Associations::CollectionProxy, @block.transactions
  end

  # Validation tests
  test "requires block_height" do
    @block.block_height = nil
    assert_not @block.valid?
    assert_includes @block.errors[:block_height], "can't be blank"
  end

  test "requires unique block_height" do
    @block.save!
    duplicate_block = @block.dup
    assert_not duplicate_block.valid?
    assert_includes duplicate_block.errors[:block_height], "has already been taken"
  end

  test "requires block_hash" do
    @block.block_hash = nil
    assert_not @block.valid?
    assert_includes @block.errors[:block_hash], "can't be blank"
  end

  test "requires unique block_hash" do
    @block.save!
    duplicate_block = @block.dup
    duplicate_block.block_height = 99999 # Change this to avoid block_height uniqueness error
    assert_not duplicate_block.valid?
    assert_includes duplicate_block.errors[:block_hash], "has already been taken"
  end

  test "requires block_timestamp" do
    @block.block_timestamp = nil
    assert_not @block.valid?
    assert_includes @block.errors[:block_timestamp], "can't be blank"
  end

  test "requires first_version" do
    @block.first_version = nil
    assert_not @block.valid?
    assert_includes @block.errors[:first_version], "can't be blank"
  end

  test "requires last_version" do
    @block.last_version = nil
    assert_not @block.valid?
    assert_includes @block.errors[:last_version], "can't be blank"
  end

  test "requires validator_address" do
    @block.validator_address = nil
    assert_not @block.valid?
    assert_includes @block.errors[:validator_address], "can't be blank"
  end

  # Network sharding tests
  test "uses correct table name for testnet" do
    Block.use_network(:testnet)
    assert_equal "blocks_testnet", Block.table_name
  end

  test "uses correct table name for mainnet" do
    Block.use_network(:mainnet)
    assert_equal "blocks_mainnet", Block.table_name
  end

  test "maintains network scope through relations" do
    Block.use_network(:testnet)
    block = Block.create!(@block.attributes)
    assert_equal "blocks_testnet", block.transactions.klass.table_name
  end

  test "resets table name after network switch" do
    original_table = Block.table_name
    Block.use_network(:testnet)
    Block.use_network(:mainnet)
    assert_equal "blocks_mainnet", Block.table_name
    Block.use_network(nil) # Reset to default
    assert_equal original_table, Block.table_name
  end

  # Version validation test
  test "last_version should be greater than or equal to first_version" do
    @block.last_version = @block.first_version - 1
    assert_not @block.valid?
    @block.last_version = @block.first_version
    assert @block.valid?
    @block.last_version = @block.first_version + 1
    assert @block.valid?
  end

  # Address format test
  test "validator_address should start with 0x" do
    @block.validator_address = "abc123"
    assert_not @block.valid?
    @block.validator_address = "0xabc123"
    assert @block.valid?
  end
end