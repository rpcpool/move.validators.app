class PublicController < ApplicationController
  def home
    @apt_info = Price.order(created_at: :desc).where(currency: "usd").limit(1).first || Price.new # CoinGeckoClient.new.price
    puts @apt_info.inspect
    @epoch = Epoch.order(epoch: :desc).limit(1).first
    @validator_count = Validator.all.count
    @validators = Validator.order('overall_score desc').limit(10)
    @cities_count = Validator.where.not(city: [nil, '']).distinct.count(:city)
    @countries_count = Validator.where.not(country: [nil, '']).distinct.count(:country)
  end
end
