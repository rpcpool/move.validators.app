module NetworkSharding
  module MigrationHelpers
    def create_sharded_table(model_class_or_name, *args, **options, &block)
      model_class_name = model_class_or_name.is_a?(Symbol) ? model_class_or_name.to_s : model_class_or_name.name.tableize
      table_name = NetworkSharding::TableNameHelper.sharded_table_name(model_class_name)
      create_table(table_name, *args, **options, &block)
    end

    def add_sharded_index(model_class_or_name, column_name, **options)
      model_class_name = model_class_or_name.is_a?(Symbol) ? model_class_or_name.to_s : model_class_or_name.name.tableize
      table_name = NetworkSharding::TableNameHelper.sharded_table_name(model_class_name)
      add_index(table_name, column_name, **options)
    end

    def add_sharded_reference(from_table, to_table, **options)
      from_table_name = NetworkSharding::TableNameHelper.sharded_table_name(from_table.to_s)
      to_table_name = NetworkSharding::TableNameHelper.sharded_table_name(to_table.to_s)

      column_name = "#{to_table_name.to_s}_id"

      # Add the column
      add_column from_table_name, column_name, :bigint

      # Add the foreign key constraint
      add_foreign_key from_table_name, to_table_name, column: column_name if options[:foreign_key]

      # Add an index on the new column
      add_index from_table_name, column_name if options[:index]
    end
  end
end
