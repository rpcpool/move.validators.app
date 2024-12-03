class CreateBlocks < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :blocks do |t|
      t.bigint :block_height, null: false
      t.string :block_hash, null: false
      t.string :epoch, null: false
      t.datetime :block_timestamp, null: false
      t.bigint :first_version, null: false
      t.bigint :last_version, null: false
      t.string :validator_address, null: false
      t.json :raw_data

      t.timestamps
    end

    add_sharded_index :blocks, :block_height, unique: true
    add_sharded_index :blocks, :block_hash, unique: true
    add_sharded_index :blocks, :first_version
    add_sharded_index :blocks, :last_version
    add_sharded_index :blocks, :validator_address
  end
end