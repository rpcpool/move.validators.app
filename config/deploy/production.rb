server(
  'www1.move.validators.app',
  user: 'deploy',
  roles: %i{web app sidekiq db}
)

server(
  'www2.move.validators.app',
  user: 'deploy',
  roles: %i{web app node_workers}
)

set :node_env, 'production'
set :aptos_network, 'mainnet'

# TODO: Set the correct Redis URL from Rails encrypted credentials
set :redis_url, 'rediss://localhost:6379'