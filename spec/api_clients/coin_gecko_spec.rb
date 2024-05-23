require 'rails_helper'

describe CoinGeckoClient do
  subject { CoinGeckoClient.new }

  let(:coingecko_ruby_double) { instance_double(CoingeckoRuby::Client) }

  before do
    allow(CoingeckoRuby::Client).to receive(:new).and_return(coingecko_ruby_double)
  end

  describe '#price' do
    before do
      allow(coingecko_ruby_double).to receive(:price).and_return(
        {
          'aptos' => {
            "usd" => 9.47,
            "usd_24h_vol" => 249900273.96863338,
            "usd_24h_change" => 3.003020408816506
          }
        }
      )
    end

    it 'returns a usd key' do
      expect(subject.price['usd']).to eq(9.47)
    end

    it 'returns a parsed usd_24h_change key' do
      expect(subject.price['usd_24h_change']).to eq(3.00)
    end

    it 'returns a parsed usd_24h_vol key' do
      expect(subject.price['usd_24h_vol']).to eq(249900273.97)
    end
  end
end
