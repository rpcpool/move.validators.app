class AddOperatorAddressToValidators < ActiveRecord::Migration[7.1]
  def change
    add_sharded_column :validators, :operator_address, :string
    add_sharded_index :validators, :operator_address
  end
end
