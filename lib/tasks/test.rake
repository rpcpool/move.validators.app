namespace :test do
  desc 'Run tests for Sidekiq jobs in test/sidekiq'
  task sidekiq_jobs: :environment do
    $: << 'test'
    
    ENV['RAILS_ENV'] ||= 'test'
    
    unless ENV['APTOS_NETWORK']
      puts "\nERROR: APTOS_NETWORK environment variable must be set"
      puts "Usage: APTOS_NETWORK=testnet bundle exec rake test:sidekiq_jobs\n\n"
      exit 1
    end
    
    Rails.env = 'test'
    
    require 'rails/test_unit/runner'
    
    pattern = 'test/sidekiq/**/*_test.rb'
    test_files = Dir[pattern].reject { |p| p =~ /^vendor/ }
    
    if test_files.empty?
      puts "No test files found in #{pattern}"
      exit
    end

    puts "\n=== Running Sidekiq Job Tests ==="
    puts "Network: #{ENV['APTOS_NETWORK']}"
    puts "Found #{test_files.length} test files"
    puts "=================================="

    Rails::TestUnit::Runner.run(test_files)
  end

  # Prevent the default test:run from running twice
  task 'sidekiq_jobs:run' => 'test:sidekiq_jobs'
end
