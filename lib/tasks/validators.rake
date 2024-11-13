namespace :validators do
  desc 'Compute validator metrics (performance, rewards, voting record)'
  task compute_metrics: :environment do
    puts "Starting validator metrics computation..."
    job_id = ValidatorComputeJob.perform_async
    puts "Enqueued ValidatorComputeJob with job_id: #{job_id}"
  end
end