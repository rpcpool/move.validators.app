# Load the sharding helper and extension
# require Rails.root.join('lib/extensions/network_shardable/table_name_helper')
# require Rails.root.join('lib/extensions/network_shardable/network_shardable')
# require Rails.root.join('lib/extensions/network_shardable/migration_helpers')
require Rails.root.join('lib/extensions/network_shardable/**/*.rb')

# Include MigrationHelpers in ActiveRecord::Migration
ActiveSupport.on_load(:active_record) do
  ActiveRecord::Migration.include NetworkSharding::MigrationHelpers
end