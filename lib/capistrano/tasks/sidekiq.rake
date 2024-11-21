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
