# config/initializers/aptos_network.rb

Rails.application.config.onchain_network = ENV.fetch('APTOS_NETWORK', 'testnet')
