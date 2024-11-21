# == Schema Information
#
# Table name: validator_performances_testnet
#
#  id                         :bigint           not null, primary key
#  epoch                      :integer
#  performance_score          :decimal(5, 2)
#  successful_proposals       :integer
#  total_proposals            :integer
#  validator_address          :string(255)      not null
#  voting_power               :bigint
#  created_at                 :datetime         not null
#  updated_at                 :datetime         not null
#  epoch_histories_testnet_id :bigint
#  validators_testnet_id      :bigint
#
# Indexes
#
#  fk_rails_4fc17c3fc5                                        (validators_testnet_id)
#  fk_rails_83b60b8b93                                        (epoch_histories_testnet_id)
#  index_validator_performances_testnet_on_epoch              (epoch)
#  index_validator_performances_testnet_on_validator_address  (validator_address)
#
# Foreign Keys
#
#  fk_rails_...  (epoch_histories_testnet_id => epoch_histories_testnet.id)
#  fk_rails_...  (validators_testnet_id => validators_testnet.id)
#
class ValidatorPerformance < ApplicationRecord
  network_shardable

  belongs_to :validator, class_name: "Validator", foreign_key: "validators_#{NETWORK}_id"
  belongs_to :epoch_history, class_name: "EpochHistory", foreign_key: "epoch_histories_#{NETWORK}_id"

  def calculate_performance_score
    return 0 if total_proposals.zero?
    (successful_proposals.to_f / total_proposals * 100).round(2)
  end

  def update_score!
    update(performance_score: calculate_performance_score)
  end
end
