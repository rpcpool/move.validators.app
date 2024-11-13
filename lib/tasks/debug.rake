namespace :debug do
  desc 'Debug last epoch performance calculations'
  task last_epoch_performance: :environment do
    puts "Analyzing block data..."
    puts

    epochs = Block.distinct.pluck(:epoch).sort
    puts "Available epochs: #{epochs.join(', ')}"
    puts "Total epochs: #{epochs.length}"
    puts

    latest_epoch = epochs.max.to_i
    last_epoch = latest_epoch - 1
    puts "Latest epoch: #{latest_epoch}"
    puts "Last complete epoch: #{last_epoch}"
    puts

    blocks_by_epoch = Block.group(:epoch).count
    puts "Blocks per epoch:"
    blocks_by_epoch.sort.each do |epoch, count|
      puts "  Epoch #{epoch}: #{count} blocks"
    end
    puts

    puts "\nSample validator performances:"
    Validator.limit(5).each do |validator|
      puts "\nValidator: #{validator.address}"
      puts "Start date: #{validator.start_date}"

      # Calculate days active
      days_active = if validator.start_date
                      ((Time.current - Time.parse(validator.start_date)) / 1.day).round
                    else
                      0
                    end
      puts "Days active: #{days_active}"

      # Get block counts
      total_blocks = Block.where(epoch: last_epoch).count
      validator_blocks = Block.where(
        epoch: last_epoch,
        validator_address: validator.address
      ).count

      # Calculate raw performance
      raw_performance = (validator_blocks.to_f / total_blocks * 100)

      # Calculate final score with age factor
      final_score = if days_active <= 365
                      raw_performance * (days_active / 365.0)
                    else
                      raw_performance
                    end
      final_score = [[final_score, 0].max, 100].min

      puts "Performance calculations:"
      puts "  Total blocks in epoch: #{total_blocks}"
      puts "  Validator blocks: #{validator_blocks}"
      puts "  Raw performance: #{raw_performance.round(2)}%"
      puts "  Age factor: #{days_active <= 365 ? (days_active / 365.0).round(4) : 1.0}"
      puts "  Final score: #{final_score.round(2)}%"
      puts "  Current DB value: #{validator.last_epoch_perf}"
    end
  end
end