class TransactionJob
  include Sidekiq::Job

  def perform(transaction_data)
    ActiveRecord::Base.transaction do
      # Check if the transaction already exists
      existing_transaction = Transaction.find_by(txn_hash: transaction_data['hash'])

      if existing_transaction
        Rails.logger.info("Transaction with hash #{transaction_data['hash']} already exists.")
        return
      end

      # Find or create the associated block
      block = find_or_create_block(transaction_data)

      # Parse and save the transaction data
      transaction = Transaction.new(
        txn_version: transaction_data['version'],
        txn_hash: transaction_data['hash'],
        state_change_hash: transaction_data['state_change_hash'],
        event_root_hash: transaction_data['event_root_hash'],
        state_checkpoint_hash: transaction_data['state_checkpoint_hash'],
        gas_used: transaction_data['gas_used'],
        success: transaction_data['success'],
        vm_status: transaction_data['vm_status'],
        accumulator_root_hash: transaction_data['accumulator_root_hash'],
        epoch: transaction_data['epoch'],
        round: transaction_data['round'],
        proposer: transaction_data['proposer'],
        timestamp: transaction_data['timestamp'],
        txn_changes: transaction_data['changes'] || [],
        txn_events: transaction_data['events'] || [],
        failed_proposer_indices: transaction_data['failed_proposer_indices'] || [],
        previous_block_votes_bitvec: transaction_data['previous_block_votes_bitvec'] || [],
        block: block
      )

      if transaction.save
        Rails.logger.info("TransactionJob: Transaction with hash #{transaction_data['hash']} saved successfully.")
        broadcast_block_info(block)
      else
        Rails.logger.error("Failed to save transaction: #{transaction.errors.full_messages.join(', ')}")
      end
    end
  end

  private

  def find_or_create_block(transaction_data)
    block_height = transaction_data['block_height']
    block = Block.find_by(block_height: block_height)

    unless block
      block = Block.create!(
        block_height: block_height,
        block_hash: transaction_data['block_hash'],
        block_timestamp: Time.at(transaction_data['timestamp'].to_i / 1_000_000),
        first_version: transaction_data['first_version'],
        last_version: transaction_data['last_version'],
        validator_address: transaction_data['proposer']
      )
      Rails.logger.info("Created new block with height #{block_height}")
    end

    block
  end

  def broadcast_block_info(block)
    ActionCable.server.broadcast(
      "front_stats_channel",
      {
        block_height: block.block_height,
        block_hash: block.block_hash,
        validator_address: block.validator_address,
        timestamp: block.block_timestamp
      }
    )
  end
end