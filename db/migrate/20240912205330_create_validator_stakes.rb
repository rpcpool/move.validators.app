class CreateValidatorStakes < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :validator_stakes do |t|
      t.string :validator_address, null: false
      t.bigint :version, null: false
      t.string :amount, null: false
      t.datetime :recorded_at, null: false
      t.string :epoch, null: false

      t.timestamps
    end

    add_sharded_index :validator_stakes, :version
    add_sharded_index :validator_stakes, :validator_address
    add_sharded_index :validator_stakes, [:validator_address, :version], unique: true
    add_sharded_index :validator_stakes, :recorded_at
    add_sharded_index :validator_stakes, :epoch
  end
end
