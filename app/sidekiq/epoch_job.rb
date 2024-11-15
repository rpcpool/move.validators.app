class EpochJob
  include Sidekiq::Job

  def perform(epoch_data)
    # puts "Received epoch data: #{epoch_data}"

    # {"currentEpoch"=>15501, "validatorsCount"=>15, "startingSlot"=>291229200, "blocksPerEpoch"=>3600, "currentHeight"=>291230310, "totalStaked"=>"20030166275865969", "averageValidatorStake"=>1335344418391064.5, "totalRewards"=>"4578353681602057344000"}

    #            currentEpoch: data.epoch,
    #             startingSlot: data.oldest_block_height,
    #             blockHeight: data.block_height,
    #             ledgerVersion: data.ledger_version,
    #             blocksPerEpoch: "3600",
    #             totalStaked: "20030166275865969",
    #             averageValidatorStake: "1335344418391064.5",

    # Parse the epoch data
    current_epoch = epoch_data["currentEpoch"]
    # validators_count = epoch_data["validatorsCount"]
    starting_slot = epoch_data["startingSlot"]
    blocks_per_epoch = epoch_data["blocksPerEpoch"]
    # current_height = epoch_data["currentHeight"]
    total_staked = epoch_data["totalStaked"].to_i
    average_validator_stake = epoch_data["averageValidatorStake"].to_f
    # total_rewards = epoch_data["totalRewards"].to_i
    #

    # Find or initialize the epoch record
    epoch = Epoch.find_or_initialize_by(epoch: current_epoch)

    # Update the attributes
    epoch.assign_attributes(
      avg_validator_staked: average_validator_stake,
      slots_in_epoch: blocks_per_epoch,
      starting_slot: starting_slot,
      # total_rewards: total_rewards,
      total_stake: total_staked
    )

    # Save the epoch record
    if epoch.save
      puts "EpochJob: Epoch #{current_epoch} saved successfully."
    else
      puts "Failed to save epoch #{current_epoch}: #{epoch.errors.full_messages.join(', ')}"
    end
  end
end
