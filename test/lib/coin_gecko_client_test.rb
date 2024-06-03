require 'test_helper'

class CoinGeckoClientTest < ActiveSupport::TestCase
  def setup
    @client = CoinGeckoClient.new
  end

  def test_price_success
    mock_api_client = Minitest::Mock.new
    def mock_api_client.price(ids, currency: 'usd', **options); {
      "aptos" => {
        'usd' => 10.0,
        'usd_24h_vol' => 1000.0,
        'usd_24h_change' => 5.0
      }
    } end

    CoingeckoRuby::Client.stub(:new, mock_api_client) do
      result = CoinGeckoClient.new.price

      assert_equal 10.0, result[:usd]
      assert_equal 1000.0, result[:usd_24h_vol]
      assert_equal 5.0, result[:usd_24h_change]
    end
  end

  def test_price_json_parser_error
    mock_api_client = Minitest::Mock.new
    mock_api_client.expect(:price, nil) do
      raise JSON::ParserError
    end

    @client.instance_variable_set(:@api_client, mock_api_client)

    assert_raises(CoinGeckoClient::CoinGeckoResponseError) do
      @client.price
    end

    mock_api_client.verify
  end
end