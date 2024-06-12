require 'test_helper'

class ValidatorTest < ActiveSupport::TestCase
  def setup
    @validator = Validator.new(
      address: '0x1234567890abcdef',
      consensus_public_key: 'consensus_public_key',
      domain: 'example.com',
      fullnode_address: 'fullnode_address',
      name: 'ValidatorName',
      network_address: 'network_address',
      validator_index: 1,
      voting_power: '1000'
    )
  end

  test "should be valid" do
    assert @validator.valid?
  end

  # TODO: When we finish building out the model, we'll turn on the presence validation
  #
  # test "address should be present" do
  #   @validator.address = nil
  #   assert_not @validator.valid?
  # end
  #
  # test "name should be present" do
  #   @validator.name = nil
  #   assert_not @validator.valid?
  # end
  #
  # test "consensus_public_key should be present" do
  #   @validator.consensus_public_key = nil
  #   assert_not @validator.valid?
  # end
  #
  # test "domain should be present" do
  #   @validator.domain = nil
  #   assert_not @validator.valid?
  # end
  #
  # test "fullnode_address should be present" do
  #   @validator.fullnode_address = nil
  #   assert_not @validator.valid?
  # end
  #
  # test "network_address should be present" do
  #   @validator.network_address = nil
  #   assert_not @validator.valid?
  # end
  #
  # test "validator_index should be present" do
  #   @validator.validator_index = nil
  #   assert_not @validator.valid?
  # end
  #
  # test "voting_power should be present" do
  #   @validator.voting_power = nil
  #   assert_not @validator.valid?
  # end

  test "set_faker_avatar_url should set avatar_url if blank" do
    @validator.avatar_url = nil
    @validator.send(:set_faker_avatar_url)
    assert_not_nil @validator.avatar_url
  end

  test "set_data should set default values if not present" do
    @validator.scores = nil
    @validator.active_stake = nil
    @validator.commission = nil
    @validator.location = nil
    @validator.operator_address = nil
    @validator.staking_address = nil
    @validator.performance = nil

    @validator.send(:set_data)

    assert_not_nil @validator.scores
    assert_not_nil @validator.active_stake
    assert_not_nil @validator.commission
    assert_not_nil @validator.location
    assert_not_nil @validator.operator_address
    assert_not_nil @validator.staking_address
    assert_not_nil @validator.performance
  end

  test "should attach an avatar" do
    @validator.avatar.attach(io: File.open(Rails.root.join('test', 'fixtures', 'files', 'avatar.png')), filename: 'avatar.png', content_type: 'image/png')
    assert @validator.avatar.attached?
  end
end
