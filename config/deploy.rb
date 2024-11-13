# config valid for current version and patch releases of Capistrano
lock "~> 3.16.0"

set :application, "move.validators.app"
set :repo_url, "https://github.com/rpcpool/move.validators.app.git"
set :user, 'deploy'

ask :branch, `git rev-parse --abbrev-ref HEAD`.chomp

# Default deploy_to directory is /var/www/my_app_name
# set :deploy_to, "/var/www/my_app_name"

append :linked_files, 'config/database.yml'
append :linked_files, "config/credentials/#{fetch(:stage)}.key"

append :linked_dirs, 'log', 'tmp/pids', 'tmp/cache', 'tmp/sockets', 'public/system', '.bundle'

# Default value for keep_releases is 5
# set :keep_releases, 5

# set :bundle_bins, fetch(:bundle_bins, []).push('bundle')
# set :bundle_path, -> { nil }
# set :bundle_command, Whenever.bundler? ? "/usr/local/bin/bundle exec" : ""

# set :passenger_environment_variables, { path: '/usr/sbin/passenger-status:$PATH' }