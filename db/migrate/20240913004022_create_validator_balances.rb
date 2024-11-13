class CreateValidatorBalances < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :validator_balances do |t|
      t.string :validator_address, null: false
      t.string :total_balance, null: false
      t.string :staked_amount, null: false
      t.string :available_amount, null: false
      t.datetime :recorded_at, null: false
      t.string :epoch, null: false
      t.bigint :version, null: false

      t.timestamps
    end

    add_sharded_index :validator_balances, :validator_address
    add_sharded_index :validator_balances, :epoch
    add_sharded_index :validator_balances, :recorded_at
    add_sharded_index :validator_balances, :version
  end
end
