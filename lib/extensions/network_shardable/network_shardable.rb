module NetworkSharding
  module NetworkShardable
    extend ActiveSupport::Concern

    class_methods do
      def network_shardable
        table_name = TableNameHelper.sharded_table_name(name.tableize)
        self.table_name = table_name
      end
    end
  end
end

# Ensure the module is loaded
ActiveSupport.on_load(:active_record) do
  ActiveRecord::Base.extend(NetworkSharding::NetworkShardable::ClassMethods)
end
