module Extensions
  module NetworkSharding
    module ColumnNameHelper
      def self.sharded_column_name(base_name, table_name = nil, connection = nil)
        return base_name.to_s unless base_name.to_s.end_with?('_id')

        if table_name && connection
          begin
            # Check if this is a regular column in the current table
            columns = connection.columns(table_name)
            return base_name.to_s if columns.any? { |c| c.name == base_name.to_s }
          rescue ActiveRecord::StatementInvalid
            # Table might not exist yet during creation
          end
        end

        # Treat as foreign key if not found as regular column
        referenced_table = base_name.to_s.chomp('_id').pluralize
        "#{referenced_table}_#{ENV.fetch('APTOS_NETWORK', 'mainnet')}_id"
      end

    end
  end
end