module Extensions
  module NetworkSharding
    class ColumnNameHelper
      def self.sharded_column_name(base_name)
        if base_name.to_s.end_with?('_id')
          # Convert fields like 'validator_id' to 'validators_testnet_id'
          table_name = base_name.to_s.chomp('_id').pluralize
          "#{table_name}_#{ENV.fetch('APTOS_NETWORK', 'testnet')}_id"
        else
          # Handle non-foreign key columns normally
          base_name.to_s
        end
      end
    end
  end
end