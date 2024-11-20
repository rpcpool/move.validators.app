# Load the sharding helper and extension
# require Rails.root.join('lib/extensions/network_sharding/table_name_helper')
# require Rails.root.join('lib/extensions/network_sharding/network_shardable')
# require Rails.root.join('lib/extensions/network_sharding/migration_helpers')

# Include MigrationHelpers in ActiveRecord::Migration
ActiveSupport.on_load(:active_record) do
  ActiveRecord::Migration.include Extensions::NetworkSharding::MigrationHelpers
end
