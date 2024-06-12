require_relative '../../lib/extensions/network_shardable/table_name_helper'

class CreateEpochHistories < ActiveRecord::Migration[7.1]
  def change
      create_sharded_table :epoch_histories do |t|
      t.string :batch_uuid
      t.integer :epoch
      t.string :ledger_version
      t.string :oldest_ledger_version
      t.string :ledger_timestamp
      t.string :node_role
      t.string :oldest_block_height
      t.string :block_height
      t.string :git_hash

      t.timestamps
    end
  end
end
