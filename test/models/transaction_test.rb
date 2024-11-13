require "test_helper"

class TransactionTest < ActiveSupport::TestCase
  def setup
    @block = Block.create!(
      block_height: 12345,
      block_hash: "0x" + "a" * 64,
      block_timestamp: Time.current,
      first_version: 1000,
      last_version: 1100,
      validator_address: "0x" + "b" * 64
    )

    @transaction = Transaction.new(
      txn_hash: "0x" + "c" * 64,
      txn_version: "1000",
      success: true,
      proposer: "0x" + "d" * 64,
      epoch: "100",
      round: "1",
      timestamp: Time.current.to_i,
      block: @block
    )
  end

  test "valid transaction" do
    assert @transaction.valid?
  end

  # Association tests
  test "belongs to block" do
    assert_respond_to @transaction, :block
    assert_equal @block, @transaction.block
  end

  test "allows nil block" do
    @transaction.block = nil
    assert @transaction.valid?
  end

  # Validation tests
  test "requires txn_hash" do
    @transaction.txn_hash = nil
    assert_not @transaction.valid?
    assert_includes @transaction.errors[:txn_hash], "can't be blank"
  end

  test "requires unique txn_hash" do
    @transaction.save!
    duplicate_transaction = @transaction.dup
    duplicate_transaction.txn_version = "2000" # Change to avoid version uniqueness error
    assert_not duplicate_transaction.valid?
    assert_includes duplicate_transaction.errors[:txn_hash], "has already been taken"
  end

  test "requires txn_version" do
    @transaction.txn_version = nil
    assert_not @transaction.valid?
    assert_includes @transaction.errors[:txn_version], "can't be blank"
  end

  test "requires unique txn_version" do
    @transaction.save!
    duplicate_transaction = @transaction.dup
    duplicate_transaction.txn_hash = "0x" + "f" * 64 # Change to avoid hash uniqueness error
    assert_not duplicate_transaction.valid?
    assert_includes duplicate_transaction.errors[:txn_version], "has already been taken"
  end

  test "requires success to be boolean" do
    @transaction.success = nil
    assert_not @transaction.valid?
    assert_includes @transaction.errors[:success], "is not included in the list"

    @transaction.success = true
    assert @transaction.valid?

    @transaction.success = false
    assert @transaction.valid?
  end

  # Scope tests
  test "successful scope returns only successful transactions" do
    successful_txn = Transaction.create!(@transaction.attributes)
    failed_txn = Transaction.create!(
      @transaction.attributes.merge(
        txn_hash: "0x" + "e" * 64,
        txn_version: "2000",
        success: false
      )
    )

    successful_transactions = Transaction.successful
    assert_includes successful_transactions, successful_txn
    assert_not_includes successful_transactions, failed_txn
  end

  test "failed scope returns only failed transactions" do
    successful_txn = Transaction.create!(@transaction.attributes)
    failed_txn = Transaction.create!(
      @transaction.attributes.merge(
        txn_hash: "0x" + "e" * 64,
        txn_version: "2000",
        success: false
      )
    )

    failed_transactions = Transaction.failed
    assert_includes failed_transactions, failed_txn
    assert_not_includes failed_transactions, successful_txn
  end

  # JSON field initialization tests
  test "initializes empty arrays for JSON fields" do
    transaction = Transaction.new
    assert_equal [], transaction.txn_changes
    assert_equal [], transaction.txn_events
    assert_equal [], transaction.failed_proposer_indices
    assert_equal [], transaction.previous_block_votes_bitvec
  end

  test "preserves existing JSON field values" do
    @transaction.txn_changes = [{ "key" => "value" }]
    @transaction.txn_events = [{ "event" => "data" }]
    @transaction.failed_proposer_indices = [1, 2, 3]
    @transaction.previous_block_votes_bitvec = ["0", "1"]

    @transaction.save!
    @transaction.reload

    assert_equal [{ "key" => "value" }], @transaction.txn_changes
    assert_equal [{ "event" => "data" }], @transaction.txn_events
    assert_equal [1, 2, 3], @transaction.failed_proposer_indices
    assert_equal ["0", "1"], @transaction.previous_block_votes_bitvec
  end

  # Network sharding tests
  test "uses correct table name for testnet" do
    Transaction.use_network(:testnet)
    assert_equal "transactions_testnet", Transaction.table_name
  end

  test "uses correct table name for mainnet" do
    Transaction.use_network(:mainnet)
    assert_equal "transactions_mainnet", Transaction.table_name
  end

  test "maintains association with correct network" do
    Transaction.use_network(:testnet)
    Block.use_network(:testnet)

    transaction = Transaction.create!(@transaction.attributes)
    assert_equal "blocks_testnet", transaction.block.class.table_name
  end

  # Optional field tests
  test "allows optional fields to be nil" do
    optional_fields = %i[
      accumulator_root_hash
      event_root_hash
      gas_used
      state_change_hash
      state_checkpoint_hash
      vm_status
      epoch
      round
      proposer
    ]

    optional_fields.each do |field|
      @transaction[field] = nil
      assert @transaction.valid?, "#{field} should be optional"
    end
  end
end