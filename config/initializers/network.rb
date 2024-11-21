# Sets NETWORK based on environment variables or Rails environment
NETWORK = ENV['APTOS_NETWORK'] || ENV['APTOS']

if Rails.env.production?
  NETWORK = 'mainnet'
elsif NETWORK.nil?
  NETWORK = 'testnet'
end
NETWORK.freeze