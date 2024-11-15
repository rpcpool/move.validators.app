# add_sharded_reference has to be in its own migration due to how it works
# same for the dependent indexes

class AddValidatorRefToStakeHistories < ActiveRecord::Migration[7.1]
  def up
    add_sharded_reference :stake_histories, :validators, foreign_key: true

    add_sharded_index :stake_histories, [:validator_id, :version]
    add_sharded_index :stake_histories, [:validator_id, :epoch]
  end

  def down
    # Remove foreign key constraint FIRST
    remove_sharded_foreign_key :stake_histories, :validators

    # Then remove indexes
    remove_sharded_index :stake_histories, [:validator_id, :epoch]
    remove_sharded_index :stake_histories, [:validator_id, :version]

    # Finally remove the column
    remove_sharded_column :stake_histories, "validators_testnet_id"
  end
end