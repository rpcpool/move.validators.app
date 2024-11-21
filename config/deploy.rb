require File.expand_path("./environment", __dir__)

# config valid for current version and patch releases of Capistrano
lock "~> 3.16.0"

set :application, "move.validators.app"
set :repo_url, "https://github.com/rpcpool/move.validators.app.git"
set :user, 'deploy'

ask :branch, `git rev-parse --abbrev-ref HEAD`.chomp

set :deploy_to, "/home/deploy/move.validators.app"

append :linked_files, 'config/database.yml'
append :linked_files, "config/credentials/#{fetch(:stage)}.key"

append :linked_dirs, 'log', 'tmp/pids', 'tmp/cache', 'tmp/sockets', 'public/system', '.bundle'

# Default value for keep_releases is 5
# set :keep_releases, 5

# set :bundle_bins, fetch(:bundle_bins, []).push('bundle')
# set :bundle_path, -> { nil }
# set :bundle_command, Whenever.bundler? ? "/usr/local/bin/bundle exec" : ""

set :passenger_environment_variables, { path: '/usr/sbin/passenger-status:$PATH' }

set :redis_url, Rails.application.credentials.dig(:redis, :url)
set :redis_username, Rails.application.credentials[:redis][:username]
set :redis_password, Rails.application.credentials[:redis][:password]

set(:systemd_service_names, %w[
  block-proposals
  block-update-fetch
  epoch-backfiller
  epoch-history
  ledger-info
  stake-history
  transactions
  validator-rewards
  validator-votes
])

# validators-list
# coingecko-prices

# SIDEKIQ CONFIG
set :sidekiq_roles, :sidekiq
set :sidekiq_config, File.join(current_path, 'config', 'sidekiq.yml').to_s

after 'deploy:updated', 'deploy:npm_install'