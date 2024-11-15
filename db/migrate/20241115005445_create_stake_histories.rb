class CreateStakeHistories < ActiveRecord::Migration[7.1]
  create_sharded_table :stake_histories do |t|
    t.string :version, null: false # Blockchain version number
    t.string :sequence_number # Event sequence number
    t.string :event_type, null: false # Type of event (add_stake, withdraw_stake, etc.)

    t.string :active_stake # Current active stake
    t.string :pending_active_stake # Pending active stake
    t.string :pending_inactive_stake # Pending inactive stake
    t.string :inactive_stake # Current inactive stake

    t.string :pool_address # Address of the stake pool
    t.string :operator_address # Address of the operator
    t.string :commission_percentage # Operator's commission percentage
    t.integer :epoch # Epoch number when this occurred
    t.string :event_guid # GUID from the event

    # Status
    t.string :status # active, pending_active, or inactive
    t.string :voting_power # Validator's voting power

    # Raw data for future reference
    t.longtext :raw_data

    t.datetime :blockchain_timestamp # Timestamp from the blockchain
    t.timestamps # Created/updated timestamps for our records
  end

  add_sharded_index :stake_histories, :version
  add_sharded_index :stake_histories, :epoch
  add_sharded_index :stake_histories, :event_type
  add_sharded_index :stake_histories, :status
  add_sharded_index :stake_histories, :blockchain_timestamp
  add_sharded_index :stake_histories, :voting_power
end