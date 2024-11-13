
class CreateTransactions < ActiveRecord::Migration[7.1]
  def change
    create_sharded_table :transactions do |t|
      # Basic transaction information
      t.string :txn_version
      t.string :txn_hash
      t.string :state_change_hash
      t.string :event_root_hash
      t.string :state_checkpoint_hash
      t.string :gas_used
      t.boolean :success
      t.string :vm_status
      t.string :accumulator_root_hash

      # Epoch and round details
      t.string :epoch
      t.string :round
      t.string :proposer
      t.bigint :timestamp

      # Additional fields for changes, events, and others
      t.json :txn_changes
      t.json :txn_events
      t.json :failed_proposer_indices
      t.json :previous_block_votes_bitvec

      t.timestamps
    end

    add_sharded_index :transactions, :txn_hash, unique: true
    add_sharded_index :transactions, :txn_version, unique: true
  end
end
