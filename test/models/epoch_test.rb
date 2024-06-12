require 'test_helper'

class EpochTest < ActiveSupport::TestCase
  def setup
    @epoch = Epoch.new(
      avg_validator_staked: 1000,
      epoch: 1,
      slots_in_epoch: 100,
      starting_slot: 1,
      total_rewards: 500,
      total_stake: 10000
    )
  end

  # TODO: When we finish building out the model, we'll turn on the presence validation
  #   test "should be valid" do
  #     assert @epoch.valid?
  #   end
  #
  #   test "should save valid epoch" do
  #     assert_difference('Epoch.count') do
  #       @epoch.save
  #     end
  #   end
  #
  #   test "should not save without epoch" do
  #     @epoch.epoch = nil
  #     assert_not @epoch.save
  #   end
  #
  #   test "should not save without avg_validator_staked" do
  #     @epoch.avg_validator_staked = nil
  #     assert @epoch.save, "Epoch can be saved without avg_validator_staked"
  #   end
  #
  #   test "should not save without slots_in_epoch" do
  #     @epoch.slots_in_epoch = nil
  #     assert @epoch.save, "Epoch can be saved without slots_in_epoch"
  #   end
  #
  #   test "should not save without starting_slot" do
  #     @epoch.starting_slot = nil
  #     assert @epoch.save, "Epoch can be saved without starting_slot"
  #   end
  #
  #   test "should not save without total_rewards" do
  #     @epoch.total_rewards = nil
  #     assert @epoch.save, "Epoch can be saved without total_rewards"
  #   end
  #
  #   test "should not save without total_stake" do
  #     @epoch.total_stake = nil
  #     assert @epoch.save, "Epoch can be saved without total_stake"
  #   end

end
