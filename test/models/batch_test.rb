require "test_helper"

class BatchTest < ActiveSupport::TestCase
  def setup
    @batch = Batch.new(
      gathered_at: Time.current,
      network: "mainnet",
      scored_at: Time.current,
      software_version: "1.0.0"
    )
  end

  test "valid batch" do
    assert @batch.valid?
  end

  test "generates uuid before create" do
    @batch.save
    assert_not_nil @batch.uuid
    assert_match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, @batch.uuid)
  end

  test "requires gathered_at" do
    @batch.gathered_at = nil
    assert_not @batch.valid?
    assert_includes @batch.errors[:gathered_at], "can't be blank"
  end

  test "requires network" do
    @batch.network = nil
    assert_not @batch.valid?
    assert_includes @batch.errors[:network], "can't be blank"
  end

  test "requires scored_at" do
    @batch.scored_at = nil
    assert_not @batch.valid?
    assert_includes @batch.errors[:scored_at], "can't be blank"
  end

  test "requires software_version" do
    @batch.software_version = nil
    assert_not @batch.valid?
    assert_includes @batch.errors[:software_version], "can't be blank"
  end

  test "requires uuid" do
    @batch.uuid = nil
    assert_not @batch.valid?
    assert_includes @batch.errors[:uuid], "can't be blank"
  end

  test "preserves existing uuid" do
    existing_uuid = SecureRandom.uuid
    batch = Batch.new(
      gathered_at: Time.current,
      network: "mainnet",
      scored_at: Time.current,
      software_version: "1.0.0",
      uuid: existing_uuid
    )
    batch.save
    assert_equal existing_uuid, batch.uuid
  end

  test "different batches get different uuids" do
    @batch.save
    other_batch = Batch.new(
      gathered_at: Time.current,
      network: "testnet",
      scored_at: Time.current,
      software_version: "1.0.0"
    )
    other_batch.save
    assert_not_equal @batch.uuid, other_batch.uuid
  end
end