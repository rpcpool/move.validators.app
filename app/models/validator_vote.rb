# == Schema Information
#
# Table name: validator_votes_testnet
#
#  id                :bigint           not null, primary key
#  epoch             :string(255)      not null
#  recorded_at       :datetime         not null
#  validator_address :string(255)      not null
#  vote_status       :string(255)      not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  proposal_id       :string(255)      not null
#
# Indexes
#
#  idx_on_validator_address_proposal_id_c7e1376f72     (validator_address,proposal_id) UNIQUE
#  index_validator_votes_testnet_on_epoch              (epoch)
#  index_validator_votes_testnet_on_proposal_id        (proposal_id)
#  index_validator_votes_testnet_on_recorded_at        (recorded_at)
#  index_validator_votes_testnet_on_validator_address  (validator_address)
#
class ValidatorVote < ApplicationRecord
  network_shardable

  belongs_to :validator, foreign_key: :validator_address, primary_key: :address, optional: true

  validates :vote_status, inclusion: { in: %w[participated missed] }

  scope :participated, -> { where(vote_status: 'participated') }
  scope :missed, -> { where(vote_status: 'missed') }
  scope :by_epoch, ->(epoch) { where(epoch: epoch) }
  scope :recent, -> { order(recorded_at: :desc) }

  def self.participation_rate
    total = count
    return 0 if total.zero?

    (participated.count.to_f / total * 100).round(2)
  end
end
