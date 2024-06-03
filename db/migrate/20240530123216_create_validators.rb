class CreateValidators < ActiveRecord::Migration[7.1]
  def change
    create_table :validators do |t|
      t.string :name
      t.string :network
      t.string :avatar_url


      t.timestamps
    end
  end
end
