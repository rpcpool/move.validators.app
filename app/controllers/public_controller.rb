class PublicController < ApplicationController
  def home
    @apt_info = CoinGeckoClient.new.price
    @epoch = Epoch.order(epoch: :desc).limit(1).first
    @validator_count = Validator.all.count
    @cities_count = Validator.where.not(city: [nil, '']).distinct.count(:city)
    @countries_count = Validator.where.not(country: [nil, '']).distinct.count(:country)
  end
end
