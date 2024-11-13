class AddBlockRefToTransactions < ActiveRecord::Migration[7.1]
  def change
    add_sharded_reference :transactions, :blocks, foreign_key: true
  end
end
