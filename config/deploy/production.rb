server(
  'www1.move.validators.app',
  user: 'deploy',
  roles: %i{web app sidekiq db}
)

server(
  'www2.move.validators.app',
  user: 'deploy',
  roles: %i{web app sidekiq}
)

set :deploy_to, "/home/deploy/move.validators.app"
