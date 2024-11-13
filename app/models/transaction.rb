# == Schema Information
#
# Table name: transactions_testnet
#
#  id                          :bigint           not null, primary key
#  accumulator_root_hash       :string(255)
#  epoch                       :string(255)
#  event_root_hash             :string(255)
#  failed_proposer_indices     :json
#  gas_used                    :string(255)
#  previous_block_votes_bitvec :json
#  proposer                    :string(255)
#  round                       :string(255)
#  state_change_hash           :string(255)
#  state_checkpoint_hash       :string(255)
#  success                     :boolean
#  timestamp                   :bigint
#  txn_changes                 :json
#  txn_events                  :json
#  txn_hash                    :string(255)
#  txn_version                 :string(255)
#  vm_status                   :string(255)
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  blocks_testnet_id           :bigint
#
# Indexes
#
#  fk_rails_81e5829f0a                        (blocks_testnet_id)
#  index_transactions_testnet_on_txn_hash     (txn_hash) UNIQUE
#  index_transactions_testnet_on_txn_version  (txn_version) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (blocks_testnet_id => blocks_testnet.id)
#
class Transaction < ApplicationRecord
  network_shardable

  belongs_to :block, optional: true

  validates :txn_hash, presence: true, uniqueness: true
  validates :txn_version, presence: true, uniqueness: true
  validates :success, inclusion: { in: [true, false] }

  # Custom scopes for common queries
  scope :successful, -> { where(success: true) }
  scope :failed, -> { where(success: false) }

  # Set default values for JSON fields in the model
  after_initialize do
    self.txn_changes ||= []
    self.txn_events ||= []
    self.failed_proposer_indices ||= []
    self.previous_block_votes_bitvec ||= []
  end
end
