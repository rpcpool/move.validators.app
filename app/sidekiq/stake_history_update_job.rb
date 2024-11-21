# This job is a data update job. There can and will be stake histories that do not have an epoch. The
# epoch is critical because the reporting for stake history is dependent on the epoch.
# When a stake history is upserted, it checks for a missing epoch. If so, then it pushes a message
# to the BlockUpdateFetch daemon along with the stake history id. The daemon fetches the block info
# and then sends the message back here. We then save the block info - which helps update our block
# data - and then updates the epoch in the stake history, making it reportable.

class StakeHistoryUpdateJob
  include Sidekiq::Job

  def perform(data)
    id = data["stake_history_id"]
    stake_history = StakeHistory.find_by(id: id)

    if stake_history.nil?
      puts "Stake history not found for id #{id} - exiting"
      return
    end

    block_data = data["block"]

    # Save block if we have block data
    if block_data
      block = Block.find_or_initialize_by(
        block_height: block_data["block_height"],
        block_hash: block_data["block_hash"]
      )

      block.assign_attributes(
        block_timestamp: block_data["block_timestamp"],
        first_version: block_data["first_version"],
        last_version: block_data["last_version"],
        epoch: block_data["epoch"],
        validator_address: block_data["validator_address"],
        raw_data: block_data["raw_data"]
      )

      if block.save
        puts "Saved block height #{block.block_height}, epoch #{block.epoch}"
      else
        puts "Failed to save block: #{block.errors.full_messages.join(', ')}"
      end
    end

    # Update stake history with epoch
    if data["epoch"]
      stake_history.update(epoch: data["epoch"])
      puts "Updated stake history #{stake_history.id} with epoch #{data["epoch"]}"
    end
  end
end