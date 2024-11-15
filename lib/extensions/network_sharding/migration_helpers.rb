module Extensions
  module NetworkSharding
    class MigrationHelpers
      def create_sharded_table(model_class_or_name, *args, **options, &block)
        model_class_name = model_class_or_name.is_a?(Symbol) ? model_class_or_name.to_s : model_class_or_name.name.tableize
        table_name = NetworkSharding::TableNameHelper.sharded_table_name(model_class_name)
        create_table(table_name, *args, **options, &block)
      end

      def add_sharded_index(model_class_or_name, column_name, **options)
        model_class_name = model_class_or_name.is_a?(Symbol) ? model_class_or_name.to_s : model_class_or_name.name.tableize
        table_name = NetworkSharding::TableNameHelper.sharded_table_name(model_class_name)

        # Transform column names if they're foreign keys
        sharded_columns = Array(column_name).map do |col|
          NetworkSharding::ColumnNameHelper.sharded_column_name(col)
        end

        add_index(table_name, sharded_columns, **options)
      end

      def remove_sharded_index(model_class_or_name, column_name, **options)
        model_class_name = model_class_or_name.is_a?(Symbol) ? model_class_or_name.to_s : model_class_or_name.name.tableize
        table_name = NetworkSharding::TableNameHelper.sharded_table_name(model_class_name)

        sharded_columns = Array(column_name).map do |col|
          NetworkSharding::ColumnNameHelper.sharded_column_name(col)
        end

        remove_index(table_name, column: sharded_columns, **options)
      rescue ArgumentError => e
        # Index doesn't exist, that's fine
      end

      def remove_sharded_foreign_key(from_table, to_table)
        from_table_name = NetworkSharding::TableNameHelper.sharded_table_name(from_table.to_s)
        to_table_name = NetworkSharding::TableNameHelper.sharded_table_name(to_table.to_s)
        remove_foreign_key from_table_name, to_table_name
      end

      def remove_sharded_column(table, column_name)
        table_name = NetworkSharding::TableNameHelper.sharded_table_name(table.to_s)
        remove_column table_name, column_name
      end

      def add_sharded_reference(from_table, to_table, **options)
        from_table_name = NetworkSharding::TableNameHelper.sharded_table_name(from_table.to_s)
        to_table_name = NetworkSharding::TableNameHelper.sharded_table_name(to_table.to_s)

        base_table_name = NetworkSharding::TableNameHelper.unsharded_table_name(to_table_name)
        column_name = "#{base_table_name}_id"
        sharded_column_name = NetworkSharding::ColumnNameHelper.sharded_column_name(column_name)

        # Add the column
        add_column from_table_name, sharded_column_name, :bigint

        # Add the foreign key constraint
        add_foreign_key from_table_name, to_table_name, column: sharded_column_name if options[:foreign_key]

        # Add an index on the new column
        add_index from_table_name, sharded_column_name if options[:index]
      end
    end
  end
end