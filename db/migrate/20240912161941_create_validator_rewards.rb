class CreateValidatorRewards < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :validator_rewards do |t|
      t.string :validator_address, null: false
      t.bigint :version, null: false
      t.bigint :sequence, null: false
      t.string :amount, null: false
      t.bigint :block_height, null: false
      t.string :block_timestamp, null: false
      t.datetime :reward_datetime, null: false

      t.timestamps
    end

    add_sharded_index :validator_rewards, :version
    add_sharded_index :validator_rewards, :validator_address
    add_sharded_index :validator_rewards, [:validator_address, :version], unique: true
    add_sharded_index :validator_rewards, :reward_datetime
  end
end