require 'test_helper'

class EpochHistoryTest < ActiveSupport::TestCase
  def setup
    @epoch_history = epoch_histories(:testnet_epoch)
  end

  test 'should be valid' do
    assert @epoch_history.valid?
  end

  test 'batch_uuid should be present' do
    @epoch_history.batch_uuid = nil
    assert_not @epoch_history.valid?
  end

  test 'epoch should be present' do
    @epoch_history.epoch = nil
    assert_not @epoch_history.valid?
  end

  test 'ledger_version should be present' do
    @epoch_history.ledger_version = nil
    assert_not @epoch_history.valid?
  end

  test 'oldest_ledger_version should be present' do
    @epoch_history.oldest_ledger_version = nil
    assert_not @epoch_history.valid?
  end

  test 'ledger_timestamp should be present' do
    @epoch_history.ledger_timestamp = nil
    assert_not @epoch_history.valid?
  end

  test 'node_role should be present' do
    @epoch_history.node_role = nil
    assert_not @epoch_history.valid?
  end

  test 'oldest_block_height should be present' do
    @epoch_history.oldest_block_height = nil
    assert_not @epoch_history.valid?
  end

  test 'block_height should be present' do
    @epoch_history.block_height = nil
    assert_not @epoch_history.valid?
  end

  test 'git_hash should be present' do
    @epoch_history.git_hash = nil
    assert_not @epoch_history.valid?
  end
end