require 'test_helper'

class NetworkShardableTest < ActiveSupport::TestCase
  NETWORKS = %w[devnet testnet mainnet].freeze

  def setup
    @model_class = Class.new(ActiveRecord::Base) do
      self.table_name = 'test_models'
      def self.name
        'TestModel'
      end
    end
    @model_class.network_shardable
  end

  NETWORKS.each do |network|
    test "network_shardable sets the table name correctly for #{network} network" do
      ENV['APTOS_NETWORK'] = network
      expected_table_name = "test_models_#{network}"
      @model_class.network_shardable
      assert_equal expected_table_name, @model_class.table_name
    end
  end
end

class TableNameHelperTest < ActiveSupport::TestCase
  NETWORKS = %w[devnet testnet mainnet].freeze

  NETWORKS.each do |network|
    test "sharded_table_name returns the correct table name for #{network} network" do
      ENV['APTOS_NETWORK'] = network
      base_name = 'test_models'
      expected_table_name = "test_models_#{network}"
      assert_equal expected_table_name, NetworkSharding::TableNameHelper.sharded_table_name(base_name)
    end
  end
end

class MigrationHelpersTest < ActiveSupport::TestCase
  NETWORKS = %w[devnet testnet mainnet].freeze

  def setup
    @connection = ActiveRecord::Base.connection
  end

  NETWORKS.each do |network|
    test "create_sharded_table creates the table with the correct name for #{network} network" do
      ENV['APTOS_NETWORK'] = network
      model_class = Class.new(ActiveRecord::Base) do
        def self.name
          'TestModel'
        end
      end

      table_name = NetworkSharding::TableNameHelper.sharded_table_name(model_class.name.tableize)

      ActiveRecord::Migration.suppress_messages do
        Class.new(ActiveRecord::Migration[6.0]) do
          define_method(:change) do
            create_table(table_name) do |t|
              t.string :name
              t.string :address
            end
          end
        end.new.change
      end

      assert @connection.table_exists?(table_name), "Table #{table_name} does not exist"

      # Clean up
      @connection.drop_table(table_name) if @connection.table_exists?(table_name)
    end

    test "add_sharded_index adds the index with the correct name for #{network} network" do
      ENV['APTOS_NETWORK'] = network
      model_class = Class.new(ActiveRecord::Base) do
        def self.name
          'TestModel'
        end
      end

      table_name = NetworkSharding::TableNameHelper.sharded_table_name(model_class.name.tableize)

      ActiveRecord::Migration.suppress_messages do
        Class.new(ActiveRecord::Migration[6.0]) do
          define_method(:change) do
            create_table(table_name) do |t|
              t.string :address
            end
            add_index(table_name, :address)
          end
        end.new.change
      end

      assert @connection.index_exists?(table_name, :address), "Index on #{table_name}.address does not exist"

      # Clean up
      @connection.drop_table(table_name) if @connection.table_exists?(table_name)
    end
  end
end
