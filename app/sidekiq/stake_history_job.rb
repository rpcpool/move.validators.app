class StakeHistoryJob
  include Sidekiq::Job
  sidekiq_options retry: 3

  def perform(data)
    validator_address = data["validator_address"]
    total_validators = data["total_validators"]
    events = data["events"][validator_address]

    puts "StakeHistoryJob: Processing validator #{validator_address} (1 of #{total_validators} total validators)"

    return unless events&.any?

    validator_id = "validators_#{NETWORK}_id"

    # Find or initialize validator
    validator = Validator.find_or_initialize_by(address: validator_address)

    events.each do |event|
      begin
        version = event["version"]
        puts "\nProcessing event with version: #{version}"

        stake_history = StakeHistory.find_or_initialize_by(
          "#{validator_id}": validator.id,
          version: version,
          sequence_number: event["guid"]["creation_number"]
        )

        # Find matching epoch
        epoch = find_epoch_for_version(version)

        # Rest of the existing code...
        case event["type"]
        when "0x1::stake::AddStakeEvent"
          stake_history.active_stake = event["data"]["amount_added"]
          stake_history.pending_active_stake = validator.active_stake
          status = "active"
        when "0x1::stake::WithdrawStakeEvent"
          stake_history.inactive_stake = event["data"]["amount_withdrawn"]
          stake_history.pending_inactive_stake = validator.active_stake
          status = "inactive"
        when "0x1::stake::JoinValidatorSetEvent"
          status = "active"
        when "0x1::stake::LeaveValidatorSetEvent"
          status = "inactive"
        end

        stake_history.assign_attributes(
          event_type: event["type"],
          pool_address: event["data"]["pool_address"],
          operator_address: event["data"]["pool_address"],
          status: status,
          event_guid: "#{event["guid"]["creation_number"]}_#{event["guid"]["account_address"]}",
          raw_data: event.to_json,
          blockchain_timestamp: Time.current,
          voting_power: validator.voting_power.presence || "0"
        )

        # Do not update the epoch attribute if it's not there since that can null it out
        unless epoch.nil?
          stake_history.assign_attributes(epoch: epoch)
        end

        if stake_history.save
          puts "Saved stake history for validator #{validator.address}:"
          puts "  Version: #{version}"
          puts "  Epoch: #{epoch || 'nil (historical data)'}"

          if event["type"] == "0x1::stake::AddStakeEvent"
            validator.update(
              active_stake: event["data"]["amount_added"]
            )
          elsif event["type"] == "0x1::stake::WithdrawStakeEvent"
            validator.update(
              active_stake: "0"
            )
          end

          # finally check to see if we were missing an epoch and if so, go do the fetch
          if epoch.nil?
            puts " Missing epoch, beginning block fetch for version #{version} and stake history id #{stake_history.id}"
            request_block_data(version, stake_history.id)
          end
        else
          puts "Failed to save stake history: #{stake_history.errors.full_messages.join(', ')}"
        end
      rescue => e
        puts "Error processing event for validator #{validator_address}:"
        puts "Event: #{event.inspect}"
        puts "Error: #{e.message}"
        puts e.backtrace
      end
    end
  end

  # The below tries to find the epoch for an exisitng block in the db. If it's not there
  # it uses the 'circular queue' to tell the nodejs side to fetch that block and fill it in.
  # In theory, once the nodejs side has that, it will place that info on the queue back for
  # a job on the rails side to save the block and then update the stake history.
  # This is important because the stake history does not work without the epoch and it is
  # not part of the stake history fetch. Furthermore, this helps us build our block info out
  # AND we have the block cache primed in the db. This is why this functionality was not
  # added on the nodejs side - it would have resulted in always calling the block endpoint
  # and that could infringe on our rate limits.
  def find_epoch_for_version(version)
    block = Block.where('first_version <= ? AND last_version >= ?', version, version)
                 .order(first_version: :desc)
                 .first

    return block.epoch unless block.nil?

    nil
  end

  def request_block_data(version, stake_history_id)
    Extensions::Queue::QueueRequest.push(
      "BlockFetchRequest",
      {
        version: version,
        stake_history_id: stake_history_id
      }
    )
  end

end