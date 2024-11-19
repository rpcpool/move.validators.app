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

set :passenger_environment_variables, { path: '/usr/sbin/passenger-status:$PATH' }


# SIDEKIQ CONFIG
set :sidekiq_roles, :sidekiq
set :sidekiq_config, File.join(current_path, 'config', 'sidekiq.yml').to_s

after 'deploy:updated', 'deploy:npm_install'

namespace :sidekiq do
  desc 'Stop sidekiq (graceful shutdown, put unfinished tasks back to Redis)'
  task :stop do
    on roles :sidekiq do |_role|
      execute :systemctl, '--user', 'stop', :sidekiq
    end
  end

  desc 'Start sidekiq'
  task :start do
    on roles :sidekiq do |_role|
      execute :systemctl, '--user', 'start', :sidekiq
    end
  end

  desc 'Restart sidekiq'
  task :restart do
    on roles(:sidekiq), in: :sequence, wait: 5 do
      execute :systemctl, '--user', 'restart', :sidekiq
    end
  end

  desc "Quiet sidekiq (stop fetching new tasks from Redis)"
  task :quiet do
    on roles(:sidekiq) do
      execute :systemctl, '--user', 'kill -s TSTP', :sidekiq
    end
  end
end