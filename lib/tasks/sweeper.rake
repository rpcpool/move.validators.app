namespace :sweeper do
  desc 'Update missing block epochs from raw data'
  task update_block_epochs: :environment do
    puts "Starting block epoch sweeper..."
    job_id = BlockEpochSweeperJob.perform_async
    puts "Enqueued BlockEpochSweeperJob with job_id: #{job_id}"
  end

  desc 'Update missing block epochs synchronously (for debugging)'
  task update_block_epochs_sync: :environment do
    puts "Starting synchronous block epoch sweep..."
    BlockEpochSweeperJob.new.perform
    puts "Completed block epoch sweep"
  end
end