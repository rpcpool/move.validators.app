class ValidatorBalanceJob
  include Sidekiq::Job
  sidekiq_options retry: 3

  def perform(data)
    validator_address = data["validator_address"]
    version = data["version"]
    epoch = data["epoch"]
    total_balance = data["total_balance"]
    staked_amount = data["staked_amount"]
    available_amount = data["available_amount"]
    recorded_at = data["recorded_at"]

    puts "ValidatorBalanceJob: Processing validator #{validator_address}"

    validator = Validator.find_by(address: validator_address)
    return unless validator

    balance = ValidatorBalance.create!(
      validator_address: validator_address,
      version: version,
      epoch: epoch,
      total_balance: total_balance,
      staked_amount: staked_amount,
      available_amount: available_amount,
      recorded_at: recorded_at
    )

    puts "Saved balance for validator #{validator_address}:"
    puts "  Total Balance: #{total_balance}"
    puts "  Staked Amount: #{staked_amount}"
    puts "  Available Amount: #{available_amount}"
    puts "  Recorded At: #{recorded_at}"
  rescue => e
    puts "Error processing balance for validator #{validator_address}:"
    puts "Error: #{e.message}"
    puts e.backtrace
  end
end
