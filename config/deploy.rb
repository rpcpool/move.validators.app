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

credentials_output = `bundle exec rails credentials:show --environment production`
credentials = YAML.safe_load(credentials_output).with_indifferent_access

set :redis_full_url, credentials.dig(:redis, :full_url)

set(:systemd_service_names, %w[
  validators-list
  coin-gecko-prices
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

# SIDEKIQ CONFIG
set :sidekiq_roles, :sidekiq
set :sidekiq_config, File.join(current_path, 'config', 'sidekiq.yml').to_s

after 'deploy:updated', 'deploy:npm_install'