# frozen_string_literal: true

# This job will go through block entries that are missing an epoch and try to update that value
# from the raw block transaction data saved (which should contain the epoch). This is important because
# the block performance compute is based on the epoch field in the block.

class BlockEpochSweeperJob
  include Sidekiq::Job

  def perform
    @processed = 0
    @updated = 0
    @errors = []

    puts "Starting BlockEpochSweeperJob..."

    # Process blocks in batches of 100
    Block.where(epoch: nil)
         .where.not(raw_data: nil)
         .find_each(batch_size: 100) do |block|
      process_block(block)
    end

    log_results
  end

  private

  def process_block(block)
    @processed += 1

    begin
      # Parse the raw_data JSON
      raw_data = JSON.parse(block.raw_data)

      # Look for block_metadata_transaction to get epoch
      if metadata_tx = find_block_metadata_transaction(raw_data)
        epoch = metadata_tx['epoch']

        if epoch.present?
          block.update_column(:epoch, epoch.to_i)
          @updated += 1
        end
      end
    rescue => e
      @errors << { block_id: block.id, error: e.message }
      puts "Error processing block #{block.id}: #{e.message}"
    end
  end

  def find_block_metadata_transaction(raw_data)
    # The block_metadata_transaction should be in the transactions array
    return nil unless raw_data['transactions'].is_a?(Array)

    raw_data['transactions'].find do |tx|
      tx['type'] == 'block_metadata_transaction'
    end
  end

  def log_results
    puts "BlockEpochSweeperJob completed:"
    puts "Processed: #{@processed} blocks"
    puts "Updated: #{@updated} blocks"

    if @errors.any?
      puts "Errors encountered:"
      @errors.each do |error|
        puts "Block #{error[:block_id]}: #{error[:error]}"
      end
    end

    # Return summary for monitoring
    {
      processed: @processed,
      updated: @updated,
      errors: @errors.length
    }
  end
end