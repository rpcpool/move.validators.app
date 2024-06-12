require 'test_helper'

class BatchTest < ActiveSupport::TestCase
  def setup
    @batch = batches(:testnet)
  end

  test 'should be valid' do
    assert @batch.valid?
  end

  test 'gathered_at should be present' do
    @batch.gathered_at = nil
    assert_not @batch.valid?
  end

  test 'network should be present' do
    @batch.network = nil
    assert_not @batch.valid?
  end

  test 'scored_at should be present' do
    @batch.scored_at = nil
    assert_not @batch.valid?
  end

  test 'software_version should be present' do
    @batch.software_version = nil
    assert_not @batch.valid?
  end

  test 'uuid should be present and unique' do
    duplicate_batch = @batch.dup
    duplicate_batch.save
    assert duplicate_batch.valid?
  end
end