# == Schema Information
#
# Table name: epoch_histories_testnet
#
#  id                    :bigint           not null, primary key
#  batch_uuid            :string(255)
#  block_height          :string(255)
#  epoch                 :integer
#  git_hash              :string(255)
#  ledger_timestamp      :string(255)
#  ledger_version        :string(255)
#  node_role             :string(255)
#  oldest_block_height   :string(255)
#  oldest_ledger_version :string(255)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
class EpochHistory < ApplicationRecord
  network_shardable

  validates :batch_uuid, presence: true
  validates :epoch, presence: true
  validates :ledger_version, presence: true
  validates :oldest_ledger_version, presence: true
  validates :ledger_timestamp, presence: true
  validates :node_role, presence: true
  validates :oldest_block_height, presence: true
  validates :block_height, presence: true
  validates :git_hash, presence: true

end
