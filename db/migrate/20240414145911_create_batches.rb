class CreateBatches < ActiveRecord::Migration[7.1]
  def change
    create_table :batches do |t|
      t.datetime :gathered_at
      t.string :network
      t.datetime :scored_at
      t.string :software_version
      t.string :uuid

      t.timestamps
    end
  end
end
