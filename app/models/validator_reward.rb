# frozen_string_literal: true

# == Schema Information
#
# Table name: validator_rewards_testnet
#
#  id                :bigint           not null, primary key
#  amount            :string(255)      not null
#  block_height      :bigint           not null
#  block_timestamp   :string(255)      not null
#  reward_datetime   :datetime         not null
#  sequence          :bigint           not null
#  validator_address :string(255)      not null
#  version           :bigint           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#
# Indexes
#
#  idx_on_validator_address_version_1d96c16337           (validator_address,version) UNIQUE
#  index_validator_rewards_testnet_on_reward_datetime    (reward_datetime)
#  index_validator_rewards_testnet_on_validator_address  (validator_address)
#  index_validator_rewards_testnet_on_version            (version)
#
class ValidatorReward < ApplicationRecord
  network_shardable

  belongs_to :validator, foreign_key: :validator_address, primary_key: :address, optional: true

  scope :recent, -> { order(reward_datetime: :desc) }
end
