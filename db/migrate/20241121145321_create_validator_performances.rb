class CreateValidatorPerformances < ActiveRecord::Migration[7.1]
  def up
    create_sharded_table :validator_performances do |t|
      t.string :validator_address, null: false
      t.integer :successful_proposals
      t.integer :total_proposals
      t.bigint :voting_power
      t.decimal :performance_score, precision: 5, scale: 2
      t.integer :epoch

      t.timestamps
    end

    add_sharded_reference :validator_performances, :validators, foreign_key: true
    add_sharded_reference :validator_performances, :epoch_histories, foreign_key: true

    add_sharded_index :validator_performances, :validator_address
    add_sharded_index :validator_performances, :epoch
  end

  # We need up/down blocks because of the foreign keys
  def down
    remove_sharded_foreign_key :validator_performances, :validators
    remove_sharded_foreign_key :validator_performances, :epoch_histories

    remove_sharded_index :validator_performances, :validator_address
    remove_sharded_index :validator_performances, :epoch

    drop_sharded_table :validator_performances
  end

end

# Table name: validator_performances_testnet
#
#  id                   :bigint           not null, primary key
#  successful_proposals :integer          # Actual completed proposals
#  total_proposals     :integer          # Proposals offered based on voting power
#  voting_power        :bigint           # Stake amount determining proposal opportunities
#  performance_score   :decimal(5,2)     # (successful/total)*100
#  epoch_number        :integer
#  validator_id        :bigint           not null
#  epoch_history_id    :bigint           not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#
# Indexes
#
#  index_validator_performances_testnet_on_validator_id      (validator_id)
#  index_validator_performances_testnet_on_epoch_history_id  (epoch_history_id)
#
# Foreign Keys
#
#  fk_rails_...  (validator_id => validators_testnet.id)
#  fk_rails_...  (epoch_history_id => epoch_histories_testnet.id)