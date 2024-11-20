# == Schema Information
#
# Table name: epochs_testnet
#
#  id                   :bigint           not null, primary key
#  avg_validator_staked :bigint
#  epoch                :integer
#  slots_in_epoch       :integer
#  starting_slot        :bigint
#  total_rewards        :bigint
#  total_stake          :bigint
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#
# Indexes
#
#  index_epochs_testnet_on_epoch  (epoch) UNIQUE

# DEPRECATED

class Epoch < ApplicationRecord
  attribute :active_validators

  network_shardable
end
