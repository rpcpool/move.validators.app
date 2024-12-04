class EpochJob
  include Sidekiq::Job

  def perform(epoch_data)
    puts ""
    puts "> Received epoch data: #{epoch_data}"
    puts ""

    # {"chain_id"=>2, "epoch"=>"19702", "ledger_version"=>"6297808749", "oldest_ledger_version"=>"0", "ledger_timestamp"=>"1732135228936948", "node_role"=>"full_node", "oldest_block_height"=>"0", "block_height"=>"397930556", "git_hash"=>"a0ec6ba11bfe4cfc5b586edc9e227aba4909e8fe", "recorded_at"=>"2024-11-20T20:40:29.384Z"}

    # Find or initialize the epoch history record
    epoch_history = EpochHistory.find_or_initialize_by(epoch: epoch_data["epoch"])

    # Update the attributes
    epoch_history.assign_attributes(
      batch_uuid: SecureRandom.uuid, # If you need this
      block_height: epoch_data["block_height"],
      git_hash: epoch_data["git_hash"],
      ledger_timestamp: epoch_data["ledger_timestamp"],
      ledger_version: epoch_data["ledger_version"],
      node_role: epoch_data["node_role"],
      oldest_block_height: epoch_data["oldest_block_height"],
      oldest_ledger_version: epoch_data["oldest_ledger_version"]
    )

    if epoch_history.save
      puts "EpochJob: Epoch history #{epoch_history.epoch} saved successfully."
    else
      puts "Failed to save epoch history #{epoch_history.epoch}: #{epoch_history.errors.full_messages.join(', ')}"
    end
  end
end
