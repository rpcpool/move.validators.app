# frozen_string_literal: true

class CoingeckoPriceJob
  include Sidekiq::Job

  def perform(price_data)
    return if price_data.nil?

    process_price(price_data)
  end

  private

  def process_price(price_data)
    price = Price.new(
      coin: 'apt',
      currency: price_data['currency'],
      price: price_data['price'],
      daily_change: price_data['24hr_change'],
      daily_volume: price_data['24hr_volume']
    )

    if price.save
      puts "Created new price record for APT/#{price_data['currency'].upcase}: #{price_data['price']}"
    else
      puts "Failed to save price: #{price.errors.full_messages.join(', ')}"
    end
  rescue => e
    puts "Error processing price for APT/#{price_data['currency'].upcase}: #{e.message}"
    puts e.backtrace.join("\n")
  end
end