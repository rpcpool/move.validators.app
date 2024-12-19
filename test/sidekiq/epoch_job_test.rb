require "test_helper"

class EpochJobTest < ActiveSupport::TestCase
  def setup
    @valid_epoch_data = {
      "epoch" => "19702",
      "ledger_version" => "6297808749",
      "oldest_ledger_version" => "0",
      "ledger_timestamp" => "1732135228936948",
      "node_role" => "full_node",
      "oldest_block_height" => "0",
      "block_height" => "397930556",
      "git_hash" => "a0ec6ba11bfe4cfc5b586edc9e227aba4909e8fe"
    }
    @job = EpochJob.new
  end

  test "processes valid epoch data" do
    assert_difference "EpochHistory.count", 1 do
      @job.perform(@valid_epoch_data)
    end

    epoch_history = EpochHistory.last
    assert_equal 19702, epoch_history.epoch # Test integer conversion
    assert_equal "6297808749", epoch_history.ledger_version
    assert_equal "397930556", epoch_history.block_height
    assert_equal "full_node", epoch_history.node_role
    assert_equal "a0ec6ba11bfe4cfc5b586edc9e227aba4909e8fe", epoch_history.git_hash
  end

  test "updates existing epoch data" do
    # Create initial epoch
    @job.perform(@valid_epoch_data)
    initial_updated_at = EpochHistory.last.updated_at
    
    sleep(0.1) # Ensure timestamp difference
    
    # Update with new data
    updated_data = @valid_epoch_data.merge(
      "ledger_version" => "6297808750",
      "block_height" => "397930557"
    )

    assert_no_difference "EpochHistory.count" do
      @job.perform(updated_data)
    end

    epoch_history = EpochHistory.find_by(epoch: 19702)
    assert_equal "6297808750", epoch_history.ledger_version
    assert_equal "397930557", epoch_history.block_height
    assert_not_equal initial_updated_at, epoch_history.updated_at, "Updated timestamp should change"
  end

  test "validates required fields" do
    EpochJob::REQUIRED_FIELDS.each do |field|
      invalid_data = @valid_epoch_data.except(field)
      
      error = assert_raises(ArgumentError) do
        @job.send(:validate_epoch_data!, invalid_data)
      end
      
      assert_match /Missing required fields: #{field}/, error.message
      # Verify no record was created
      assert_not EpochHistory.exists?(epoch: @valid_epoch_data["epoch"])
    end
  end

  test "validates numeric string formats" do
    # Test epoch format
    invalid_data = @valid_epoch_data.merge("epoch" => "not_a_number")
    error = assert_raises(ArgumentError) do
      @job.send(:validate_epoch_data!, invalid_data)
    end
    assert_match /Invalid epoch format/, error.message

    # Test other numeric fields
    %w[ledger_version oldest_ledger_version ledger_timestamp block_height oldest_block_height].each do |field|
      invalid_data = @valid_epoch_data.merge(field => "not_a_number")
      
      error = assert_raises(ArgumentError) do
        @job.send(:validate_epoch_data!, invalid_data)
      end
      
      assert_match /Invalid #{field} format/, error.message
      # Verify no record was created
      assert_not EpochHistory.exists?(epoch: @valid_epoch_data["epoch"])
    end
  end

  test "handles save failures gracefully" do
    error_messages = []
    success_messages = []
    
    Rails.logger.stub :error, ->(msg) { 
      error_messages << msg unless msg.to_s.include?("\n")
    } do
      Rails.logger.stub :info, ->(msg) { success_messages << msg } do
        EpochHistory.stub :find_or_initialize_by, ->(_) {
          history = EpochHistory.new
          history.define_singleton_method(:save) { false }
          history.errors.add(:base, "Some error")
          history
        } do
          @job.perform(@valid_epoch_data)
        end
      end
    end

    assert_equal 4, error_messages.count, "Should log 4 error messages (initial save error, job failed, error details, and data dump)"
    assert_match /Failed to save epoch history/, error_messages[0], "First message should be save error"
    assert_match /EPOCH JOB FAILED/, error_messages[1], "Second message should be job failed"
    assert_match /Error: StandardError/, error_messages[2], "Third message should be error details"
    assert_match /Epoch Data:/, error_messages[3], "Fourth message should be data dump"
    assert_equal 0, success_messages.count
    
    assert_not EpochHistory.exists?(epoch: 19702)
  end

  test "logs errors with detailed information" do
    error_messages = []
    success_messages = []
    
    Rails.logger.stub :error, ->(msg) { 
      error_messages << msg unless msg.to_s.include?("\n")
    } do
      Rails.logger.stub :info, ->(msg) { success_messages << msg } do
        EpochHistory.stub :find_or_initialize_by, ->(_) {
          raise StandardError, "Database connection lost"
        } do
          @job.perform(@valid_epoch_data)
        end
      end
    end

    assert_equal 3, error_messages.count, "Should log 3 error messages (job failed, error details, and data dump)"
    assert_match /EPOCH JOB FAILED/, error_messages[0], "First message should be job failed"
    assert_match /Database connection lost/, error_messages[1], "Second message should be error details"
    assert_match /Epoch Data:/, error_messages[2], "Third message should be data dump"
    assert_equal 0, success_messages.count
  end

  test "uniqueness configuration uses epoch and ledger_version" do
    args = [@valid_epoch_data]
    
    # Get the lock_args from the job options
    lock_args_proc = @job.class.get_sidekiq_options['lock_args']
    unique_args = lock_args_proc.call(args)
    
    expected = [@valid_epoch_data['epoch'], @valid_epoch_data['ledger_version']]
    assert_equal expected, unique_args,
      "Should use epoch and ledger_version for uniqueness"
  end

  test "processes jobs with same epoch but different ledger versions" do
    # First job
    @job.perform(@valid_epoch_data)
    
    # Same epoch, different ledger version
    new_data = @valid_epoch_data.merge(
      "ledger_version" => "6297808750",
      "block_height" => "397930557"
    )
    
    # Should process the new job and update the record
    assert_no_difference "EpochHistory.count" do
      @job.perform(new_data)
    end
    
    epoch_history = EpochHistory.find_by(epoch: 19702)
    assert_equal "6297808750", epoch_history.ledger_version,
      "Should update to new ledger version"
    assert_equal "397930557", epoch_history.block_height,
      "Should update associated block height"
  end

  test "handles identical job data appropriately" do
    # First job
    @job.perform(@valid_epoch_data)
    initial_updated_at = EpochHistory.last.updated_at
    
    sleep(0.1) # Ensure timestamp difference
    
    # Identical data
    assert_no_difference "EpochHistory.count" do
      @job.perform(@valid_epoch_data.dup)
    end
    
    # Verify data hasn't changed
    epoch_history = EpochHistory.find_by(epoch: 19702)
    assert_equal "6297808749", epoch_history.ledger_version,
      "Should maintain original ledger version"
    assert_equal initial_updated_at.to_i, epoch_history.updated_at.to_i,
      "Should not update timestamp for identical data"
  end

  test "handles edge cases in ledger version updates" do
    # Create initial epoch
    @job.perform(@valid_epoch_data)
    
    # Test with same ledger version but different block height
    edge_data = @valid_epoch_data.merge("block_height" => "397930557")
    
    assert_no_difference "EpochHistory.count" do
      @job.perform(edge_data)
    end
    
    epoch_history = EpochHistory.find_by(epoch: 19702)
    assert_equal "397930557", epoch_history.block_height,
      "Should update block height even with same ledger version"
  end

  test "respects network sharding" do
    # This test assumes network_shardable is properly configured
    # and the appropriate test database is being used
    assert_equal "epoch_histories_testnet", EpochHistory.table_name,
      "Should use the correct sharded table name"
  end
end
