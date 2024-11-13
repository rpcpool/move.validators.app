# == Schema Information
#
# Table name: validator_balances_testnet
#
#  id                :bigint           not null, primary key
#  validator_address :string           not null
#  total_balance     :string           not null
#  staked_amount     :string           not null
#  available_amount  :string           not null
#  recorded_at       :datetime         not null
#  epoch             :string           not null
#  version          :bigint           not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#
# Indexes
#
#  index_validator_balances_on_validator_address  (validator_address)
#  index_validator_balances_on_epoch             (epoch)
#  index_validator_balances_on_recorded_at       (recorded_at)
#  index_validator_balances_on_version          (version)
#
class ValidatorBalance < ApplicationRecord
  network_shardable

  belongs_to :validator, foreign_key: :validator_address, primary_key: :address, optional: true

  scope :recent, -> { order(recorded_at: :desc) }
  scope :by_epoch, ->(epoch) { where(epoch: epoch) }
  scope :by_validator, ->(address) { where(validator_address: address) }

  validates :total_balance, :staked_amount, :available_amount, presence: true
  validates :epoch, :version, :recorded_at, presence: true
  validates :validator_address, presence: true
end