# == Schema Information
#
# Table name: prices
#
#  id           :bigint           not null, primary key
#  coin         :string(255)
#  currency     :string(255)
#  daily_change :decimal(10, 4)
#  daily_volume :decimal(20, 2)
#  price        :decimal(20, 10)
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#
# Indexes
#
#  index_prices_on_currency_and_created_at  (currency,created_at DESC)
#
class Price < ApplicationRecord
end
