class EpochJob
  include Sidekiq::Job

  # Configure uniqueness to allow updates based on ledger version
  sidekiq_options(
    queue: :default,
    retry: false,
    lock: :until_executed,
    lock_args: ->(args) { [args.first['epoch'], args.first['ledger_version']] }, # Use both epoch and ledger_version for uniqueness
    on_conflict: :replace # Replace existing job if conflict
  )

  REQUIRED_FIELDS = %w[
    epoch ledger_version oldest_ledger_version ledger_timestamp
    node_role oldest_block_height block_height git_hash
  ].freeze

  def perform(epoch_data)
    validate_epoch_data!(epoch_data)
    process_epoch_data(epoch_data)

  rescue StandardError => e
    Rails.logger.error("!!! EPOCH JOB FAILED !!!")
    Rails.logger.error("!!! Error: #{e.class} - #{e.message} !!!")
    Rails.logger.error("!!! Epoch Data: #{epoch_data.inspect} !!!")
    Rails.logger.error(e.backtrace.join("\n"))
  end

  private

  def validate_epoch_data!(data)
    missing_fields = REQUIRED_FIELDS - data.keys
    if missing_fields.any?
      raise ArgumentError, "Missing required fields: #{missing_fields.join(', ')}"
    end

    unless data['epoch'].is_a?(String) && data['epoch'].match?(/^\d+$/)
      raise ArgumentError, "Invalid epoch format: #{data['epoch']}"
    end

    %w[ledger_version oldest_ledger_version ledger_timestamp block_height oldest_block_height].each do |field|
      unless data[field].is_a?(String) && data[field].match?(/^\d+$/)
        raise ArgumentError, "Invalid #{field} format: #{data[field]}"
      end
    end
  end

  def process_epoch_data(epoch_data)
    epoch_history = EpochHistory.find_or_initialize_by(epoch: epoch_data['epoch'])
    
    epoch_history.assign_attributes(
      block_height: epoch_data['block_height'],
      git_hash: epoch_data['git_hash'],
      ledger_timestamp: epoch_data['ledger_timestamp'],
      ledger_version: epoch_data['ledger_version'],
      node_role: epoch_data['node_role'],
      oldest_block_height: epoch_data['oldest_block_height'],
      oldest_ledger_version: epoch_data['oldest_ledger_version']
    )

    unless epoch_history.save
      error_msg = "Failed to save epoch history: #{epoch_history.errors.full_messages.join(', ')}"
      Rails.logger.error("!!! #{error_msg} !!!")
      raise StandardError, error_msg
    end

    Rails.logger.info("Successfully processed epoch #{epoch_data['epoch']} with ledger version #{epoch_data['ledger_version']}")
  end
end
