# == Schema Information
#
# Table name: validator_stakes_testnet
#
#  id                :bigint           not null, primary key
#  amount            :string(255)      not null
#  epoch             :string(255)      not null
#  recorded_at       :datetime         not null
#  validator_address :string(255)      not null
#  version           :bigint           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#
# Indexes
#
#  idx_on_validator_address_version_b864e2f567          (validator_address,version) UNIQUE
#  index_validator_stakes_testnet_on_epoch              (epoch)
#  index_validator_stakes_testnet_on_recorded_at        (recorded_at)
#  index_validator_stakes_testnet_on_validator_address  (validator_address)
#  index_validator_stakes_testnet_on_version            (version)
#
class ValidatorStake < ApplicationRecord
  network_shardable

  belongs_to :validator, foreign_key: :validator_address, primary_key: :address, optional: true

  scope :recent, -> { order(recorded_at: :desc) }
end
