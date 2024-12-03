# == Schema Information
#
# Table name: stake_histories_testnet
#
#  id                     :bigint           not null, primary key
#  active_stake           :string(255)
#  blockchain_timestamp   :datetime
#  commission_percentage  :string(255)
#  epoch                  :integer
#  event_guid             :string(255)
#  event_type             :string(255)      not null
#  inactive_stake         :string(255)
#  operator_address       :string(255)
#  pending_active_stake   :string(255)
#  pending_inactive_stake :string(255)
#  pool_address           :string(255)
#  raw_data               :json
#  sequence_number        :string(255)
#  status                 :string(255)
#  version                :string(255)      not null
#  voting_power           :string(255)
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  validators_testnet_id  :bigint
#
# Indexes
#
#  idx_on_validators_testnet_id_epoch_5e3c33bb6a          (validators_testnet_id,epoch)
#  idx_on_validators_testnet_id_version_78299f08e7        (validators_testnet_id,version)
#  index_stake_histories_testnet_on_blockchain_timestamp  (blockchain_timestamp)
#  index_stake_histories_testnet_on_epoch                 (epoch)
#  index_stake_histories_testnet_on_event_type            (event_type)
#  index_stake_histories_testnet_on_status                (status)
#  index_stake_histories_testnet_on_version               (version)
#  index_stake_histories_testnet_on_voting_power          (voting_power)
#
# Foreign Keys
#
#  fk_rails_...  (validators_testnet_id => validators_testnet.id)
#
class StakeHistory < ApplicationRecord
  network_shardable

  belongs_to :validator,
             -> { where(nil) },
             foreign_key: "validators_#{network}_id",
             class_name: 'Validator',
             inverse_of: :stake_histories

  validates :version, presence: true
  validates :event_type, presence: true
  validates "validators_#{network}_id", presence: true
end
