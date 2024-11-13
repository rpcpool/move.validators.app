class CreateValidatorVotes < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :validator_votes do |t|
      t.string :validator_address, null: false
      t.string :proposal_id, null: false
      t.string :vote_status, null: false  # 'participated' or 'missed'
      t.datetime :recorded_at, null: false
      t.string :epoch, null: false

      t.timestamps
    end

    add_sharded_index :validator_votes, :validator_address
    add_sharded_index :validator_votes, :proposal_id
    add_sharded_index :validator_votes, :epoch
    add_sharded_index :validator_votes, [:validator_address, :proposal_id], unique: true
    add_sharded_index :validator_votes, :recorded_at
  end
end