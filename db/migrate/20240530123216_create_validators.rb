require_relative '../../lib/extensions/network_shardable/table_name_helper'

class CreateValidators < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :validators do |t|
      t.string :name
      t.string :avatar_url
      t.integer :validator_index
      t.string :address
      t.string :voting_power
      t.string :consensus_public_key
      t.string :fullnode_address
      t.string :network_address
      t.string :domain

      t.timestamps
    end

    add_sharded_index :validators, :address
  end
end
