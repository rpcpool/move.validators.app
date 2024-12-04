class PublicController < ApplicationController
  def home
    @apt_info = Price.order(created_at: :desc).where(currency: "usd").limit(1).first || Price.new # CoinGeckoClient.new.price
    @epoch = EpochHistory.order(epoch: :desc).limit(1).first
    Rails.logger.info ""
    Rails.logger.info "Epoch: #{@epoch.inspect}"
    Rails.logger.info ""
    @validator_count = Validator.all.count
    @validators = Validator.order('overall_score desc').limit(10)
    @cities_count = Validator.where.not(city: [nil, '']).distinct.count(:city)
    @countries_count = Validator.where.not(country: [nil, '']).distinct.count(:country)
  end
end
