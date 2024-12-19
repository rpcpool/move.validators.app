require 'test_helper'

class CoingeckoPriceJobTest < ActiveSupport::TestCase
  fixtures :prices

  test "processes valid price data" do
    price_data = {
      'currency' => 'usd',
      'price' => 2.50,
      '24hr_change' => 0.5,
      '24hr_volume' => 1000000
    }

    assert_difference 'Price.count' do
      CoingeckoPriceJob.new.perform(price_data)
    end

    price = Price.last
    assert_equal 'apt', price.coin
    assert_equal 'usd', price.currency
    assert_equal 2.50, price.price
    assert_equal 0.5, price.daily_change
    assert_equal 1000000, price.daily_volume
  end

  test "handles nil input" do
    assert_no_difference 'Price.count' do
      CoingeckoPriceJob.new.perform(nil)
    end
  end

  test "handles invalid data" do
    invalid_data = {
      'currency' => 'usd',
      'price' => -1, # Invalid due to validation
      '24hr_change' => 0.5,
      '24hr_volume' => 1000000
    }

    assert_no_difference 'Price.count' do
      CoingeckoPriceJob.new.perform(invalid_data)
    end
  end
end
