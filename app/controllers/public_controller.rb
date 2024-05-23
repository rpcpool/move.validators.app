class PublicController < ApplicationController
  def home
    @apt_info = CoinGeckoClient.new.price
  end
end
