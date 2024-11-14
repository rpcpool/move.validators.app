# Sets NETWORK based on environment variables or Rails environment
NETWORK = if ENV['APTOS_NETWORK'] || ENV['APTOS'] || Rails.env.production?
            'mainnet'
          else
            'testnet'
          end.freeze