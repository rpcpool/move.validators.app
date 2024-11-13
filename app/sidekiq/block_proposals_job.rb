# frozen_string_literal: true

class BlockProposalsJob
  include Sidekiq::Job

  def perform(block_data)
    return if block_data.nil? || !block_data["blocks"].present?

    puts "BlockProposalsJob processing #{block_data["blocks"].length} blocks"

    block_data["blocks"].each do |block|
      process_block(block)
    end
  end

  private

  def process_block(block)
    if block["validator_address"].nil?
      puts "Block #{block["block_height"]} has no validator_address. Block data: #{block.inspect}"
      # Maybe track this in a counter/metric
      return
    end

    block_attributes = {
      block_height: block["block_height"],
      block_hash: block["block_hash"],
      block_timestamp: Time.at(block["block_timestamp"].to_i / 1_000_000),
      first_version: block["first_version"],
      last_version: block["last_version"],
      validator_address: block["validator_address"],
      epoch: block["epoch"],
      raw_data: block["raw_data"]
    }

    Block.upsert_all(
      [block_attributes],
      update_only: %w[block_hash block_timestamp first_version last_version validator_address]
    )
  rescue => e
    Rails.logger.error "Error processing block #{block["block_height"]}: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
  end
end