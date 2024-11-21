namespace :deploy do
  desc 'Run npm install for node workers'
  task :npm_install do
    on roles(:node_workers) do
      within release_path.join('js') do
        execute :npm, 'install'
      end
    end
  end
end
