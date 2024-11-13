class CreateValidators < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :validators do |t|
      t.string :name
      t.string :avatar_url
      t.integer :validator_index
      t.string :address
      t.string :voting_power
      t.string :successful_blocks
      t.string :failed_blocks
      t.string :balance
      t.string :active_stake
      t.string :consensus_public_key
      t.string :fullnode_address
      t.string :network_address
      t.string :domain
      t.string :ip_address
      t.string :country
      t.string :country_code
      t.string :region
      t.string :timezone
      t.string :city
      t.decimal :lat, precision: 10, scale: 6
      t.decimal :lng, precision: 10, scale: 6
      t.string :last_epoch_perf
      t.float :rewards_growth
      t.string :voting_record
      t.string :rewards
      t.string :start_date
      t.float :performance
      t.integer :blocks_purposed_day
      t.integer :blocks_purposed_week
      t.integer :blocks_purposed_month
      t.float :data_center_score
      t.float :voting_record_score
      t.float :last_epoch_score
      t.float :overall_score

      t.timestamps
    end

    add_sharded_index :validators, :address
  end
end
