require "test_helper"

class ValidatorVoteTest < ActiveSupport::TestCase
  def setup
    @validator = Validator.create!(
      address: "0x" + "a" * 64,
      name: "Test Validator"
    )

    @validator_vote = ValidatorVote.new(
      validator_address: @validator.address,
      proposal_id: "proposal_123",
      epoch: "100",
      recorded_at: Time.current,
      vote_status: "participated"
    )
  end

  test "valid validator vote" do
    assert @validator_vote.valid?
  end

  # Association tests
  test "belongs to validator" do
    assert_respond_to @validator_vote, :validator
    assert_equal @validator, @validator_vote.validator
  end

  test "allows nil validator" do
    @validator_vote.validator = nil
    assert @validator_vote.valid?
  end

  # Validation tests
  test "requires validator_address" do
    @validator_vote.validator_address = nil
    assert_not @validator_vote.valid?
    assert_includes @validator_vote.errors[:validator_address], "can't be blank"
  end

  test "requires proposal_id" do
    @validator_vote.proposal_id = nil
    assert_not @validator_vote.valid?
    assert_includes @validator_vote.errors[:proposal_id], "can't be blank"
  end

  test "requires epoch" do
    @validator_vote.epoch = nil
    assert_not @validator_vote.valid?
    assert_includes @validator_vote.errors[:epoch], "can't be blank"
  end

  test "requires recorded_at" do
    @validator_vote.recorded_at = nil
    assert_not @validator_vote.valid?
    assert_includes @validator_vote.errors[:recorded_at], "can't be blank"
  end

  test "requires vote_status" do
    @validator_vote.vote_status = nil
    assert_not @validator_vote.valid?
    assert_includes @validator_vote.errors[:vote_status], "is not included in the list"
  end

  test "validates vote_status inclusion" do
    @validator_vote.vote_status = "invalid"
    assert_not @validator_vote.valid?
    assert_includes @validator_vote.errors[:vote_status], "is not included in the list"

    @validator_vote.vote_status = "participated"
    assert @validator_vote.valid?

    @validator_vote.vote_status = "missed"
    assert @validator_vote.valid?
  end

  # Scope tests
  test "participated scope returns only participated votes" do
    participated = ValidatorVote.create!(@validator_vote.attributes)
    missed = ValidatorVote.create!(
      @validator_vote.attributes.merge(
        proposal_id: "proposal_124",
        vote_status: "missed"
      )
    )

    participated_votes = ValidatorVote.participated
    assert_includes participated_votes, participated
    assert_not_includes participated_votes, missed
  end

  test "missed scope returns only missed votes" do
    participated = ValidatorVote.create!(@validator_vote.attributes)
    missed = ValidatorVote.create!(
      @validator_vote.attributes.merge(
        proposal_id: "proposal_124",
        vote_status: "missed"
      )
    )

    missed_votes = ValidatorVote.missed
    assert_includes missed_votes, missed
    assert_not_includes missed_votes, participated
  end

  test "by_epoch scope filters by epoch" do
    vote1 = ValidatorVote.create!(@validator_vote.attributes)
    vote2 = ValidatorVote.create!(
      @validator_vote.attributes.merge(
        proposal_id: "proposal_124",
        epoch: "101"
      )
    )

    epoch_100_votes = ValidatorVote.by_epoch("100")
    assert_includes epoch_100_votes, vote1
    assert_not_includes epoch_100_votes, vote2
  end

  test "recent scope orders by recorded_at desc" do
    older_vote = ValidatorVote.create!(
      @validator_vote.attributes.merge(
        recorded_at: 1.day.ago,
        proposal_id: "proposal_124"
      )
    )
    newer_vote = ValidatorVote.create!(
      @validator_vote.attributes.merge(
        recorded_at: Time.current,
        proposal_id: "proposal_125"
      )
    )

    recent_votes = ValidatorVote.recent
    assert_equal newer_vote, recent_votes.first
    assert_equal older_vote, recent_votes.last
  end

  # Participation rate tests
  test "participation_rate returns 0 when no votes" do
    assert_equal 0, ValidatorVote.participation_rate
  end

  test "participation_rate calculates correct percentage" do
    # Create 3 participated votes and 2 missed votes
    3.times do |i|
      ValidatorVote.create!(
        @validator_vote.attributes.merge(
          proposal_id: "proposal_#{i}",
          vote_status: "participated"
        )
      )
    end

    2.times do |i|
      ValidatorVote.create!(
        @validator_vote.attributes.merge(
          proposal_id: "missed_#{i}",
          vote_status: "missed"
        )
      )
    end

    # Expected: (3 participated / 5 total) * 100 = 60%
    assert_equal 60.0, ValidatorVote.participation_rate
  end

  # Uniqueness test for combined index
  test "enforces uniqueness of validator_address and proposal_id combination" do
    @validator_vote.save!

    duplicate_vote = ValidatorVote.new(@validator_vote.attributes)
    assert_not duplicate_vote.valid?
    assert_raises(ActiveRecord::RecordNotUnique) { duplicate_vote.save!(validate: false) }

    # Different proposal_id should be valid
    duplicate_vote.proposal_id = "different_proposal"
    assert duplicate_vote.valid?

    # Different validator_address should be valid
    different_validator_vote = ValidatorVote.new(
      @validator_vote.attributes.merge(
        validator_address: "0x" + "b" * 64
      )
    )
    assert different_validator_vote.valid?
  end

  # Network sharding tests
  test "uses correct table name for testnet" do
    ValidatorVote.use_network(:testnet)
    assert_equal "validator_votes_testnet", ValidatorVote.table_name
  end

  test "uses correct table name for mainnet" do
    ValidatorVote.use_network(:mainnet)
    assert_equal "validator_votes_mainnet", ValidatorVote.table_name
  end

  # Index presence tests
  test "has required indexes" do
    indexes = ActiveRecord::Base.connection.indexes('validator_votes_testnet')

    assert indexes.any? { |i| i.columns == ['epoch'] }
    assert indexes.any? { |i| i.columns == ['proposal_id'] }
    assert indexes.any? { |i| i.columns == ['recorded_at'] }
    assert indexes.any? { |i| i.columns == ['validator_address'] }
    assert indexes.any? { |i| i.columns == ['validator_address', 'proposal_id'] && i.unique }
  end

  # Data integrity tests
  test "recorded_at should not be in the future" do
    @validator_vote.recorded_at = 1.day.from_now
    assert_not @validator_vote.valid?

    @validator_vote.recorded_at = Time.current
    assert @validator_vote.valid?
  end

  test "epoch should be a valid numerical string" do
    @validator_vote.epoch = "invalid"
    assert_not @validator_vote.valid?

    @validator_vote.epoch = "-1"
    assert_not @validator_vote.valid?

    @validator_vote.epoch = "100"
    assert @validator_vote.valid?
  end
end