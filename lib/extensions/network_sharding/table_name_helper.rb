module NetworkSharding
  module TableNameHelper
    def self.sharded_table_name(base_name)
      "#{base_name}_#{ENV.fetch('APTOS_NETWORK', 'testnet')}"
    end
  end
end
