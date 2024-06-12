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
  end
end
