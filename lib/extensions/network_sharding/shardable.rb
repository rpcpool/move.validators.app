module Extensions
  module NetworkSharding
    module Shardable
      extend ActiveSupport::Concern

      class_methods do
        def network_shardable
          self.table_name = NetworkSharding::TableNameHelper.sharded_table_name(name.tableize)
        end
      end
    end
  end
end

# Ensure the module is loaded
ActiveSupport.on_load :active_record do
  include Extensions::NetworkSharding::Shardable
end
