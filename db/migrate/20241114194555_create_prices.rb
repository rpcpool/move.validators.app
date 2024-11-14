class CreatePrices < ActiveRecord::Migration[7.1]
  def change
    create_table :prices do |t|
      t.string :currency
      t.decimal :price, precision: 20, scale: 10
      t.decimal :daily_change, precision: 10, scale: 4
      t.decimal :daily_volume, precision: 20, scale: 2
      t.string :coin

      t.timestamps
    end

    add_index :prices, [:currency, :created_at], order: { created_at: :desc }
  end
end
