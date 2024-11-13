
class CreateEpochs < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :epochs do |t|
      t.integer :epoch
      t.bigint :starting_slot
      t.integer :slots_in_epoch
      t.bigint :total_stake
      t.bigint :avg_validator_staked
      t.bigint :total_rewards

      t.timestamps
    end

    add_sharded_index :epochs, :epoch, unique: true
  end
end
