require "test_helper"

class ValidatorJobTest < ActiveSupport::TestCase
  def setup
    @valid_validator_data = {
      "address" => "0x123",
      "name" => "Test Validator",
      "validatorIndex" => "1",
      "votingPower" => "1000000",
      "consensusPublicKey" => "0xpubkey",
      "fullnodeAddress" => "fullnode_addr",
      "networkAddress" => "network_addr",
      "domain" => "test.com",
      "ip_data" => {
        "country_code" => "US",
        "country" => "United States",
        "city" => "San Francisco",
        "region" => "California",
        "timezone" => "America/Los_Angeles",
        "lat" => "37.7749",
        "lng" => "-122.4194"
      },
      "merged" => {
        "data" => {
          "stake_pool_active_value" => "2000000",
          "coin_store_value" => "3000000"
        }
      },
      "start_date" => "2024-01-01T00:00:00Z"
    }
  end

  test "processes valid validator data for new validator" do
    assert_difference "Validator.count", 1 do
      ValidatorJob.new.perform(@valid_validator_data)
    end

    validator = Validator.last
    assert_equal "0x123", validator.address
    assert_equal "Test Validator", validator.name
    assert_equal 1, validator.validator_index.to_i
    assert_equal "1000000", validator.voting_power
    assert_equal "2000000", validator.active_stake
    assert_equal "3000000", validator.balance
    assert_in_delta 37.7749, validator.lat, 0.0001
    assert_in_delta(-122.4194, validator.lng, 0.0001)
  end

  test "updates existing validator" do
    # Create initial validator
    ValidatorJob.new.perform(@valid_validator_data)
    
    # Update with new data
    updated_data = @valid_validator_data.merge(
      "votingPower" => "2000000",
      "name" => "Updated Validator"
    )

    assert_no_difference "Validator.count" do
      ValidatorJob.new.perform(updated_data)
    end

    validator = Validator.find_by(address: "0x123")
    assert_equal "Updated Validator", validator.name
    assert_equal "2000000", validator.voting_power
  end

  test "handles missing required fields gracefully" do
    invalid_data = @valid_validator_data.except("address")
    
    assert_no_difference "Validator.count" do
      ValidatorJob.new.perform(invalid_data)
    end
  end

  test "handles invalid numeric fields gracefully" do
    invalid_data = @valid_validator_data.merge("votingPower" => "not_a_number")
    
    assert_no_difference "Validator.count" do
      ValidatorJob.new.perform(invalid_data)
    end
  end

  test "handles nil validator data gracefully" do
    assert_nothing_raised do
      ValidatorJob.new.perform(nil)
    end
  end

  test "handles missing optional fields" do
    data = @valid_validator_data.dup
    data.delete("domain")
    data["ip_data"].delete("lat")
    data["ip_data"].delete("lng")

    assert_difference "Validator.count", 1 do
      ValidatorJob.new.perform(data)
    end

    validator = Validator.last
    assert_nil validator.domain
    assert_equal 0.0, validator.lat
    assert_equal 0.0, validator.lng
  end

  test "handles save failures gracefully" do
    validator = Validator.new
    def validator.save!
      raise ActiveRecord::RecordInvalid.new(self)
    end

    Validator.stub :new, validator do
      assert_nothing_raised do
        ValidatorJob.new.perform(@valid_validator_data)
      end
    end
  end

  test "processes coordinates correctly" do
    # Test string coordinates
    data = @valid_validator_data.deep_dup
    data["ip_data"]["lat"] = "45.5231"
    data["ip_data"]["lng"] = "-122.6765"
    
    ValidatorJob.new.perform(data)
    validator = Validator.last
    assert_in_delta 45.5231, validator.lat, 0.0001
    assert_in_delta(-122.6765, validator.lng, 0.0001)

    # Test numeric coordinates
    data["ip_data"]["lat"] = 37.7749
    data["ip_data"]["lng"] = -122.4194
    
    ValidatorJob.new.perform(data)
    validator.reload
    assert_in_delta 37.7749, validator.lat, 0.0001
    assert_in_delta(-122.4194, validator.lng, 0.0001)

    # Test missing coordinates
    data["ip_data"].delete("lat")
    data["ip_data"].delete("lng")
    
    ValidatorJob.new.perform(data)
    validator.reload
    assert_equal 0.0, validator.lat
    assert_equal 0.0, validator.lng
  end

  test "handles invalid coordinate values gracefully" do
    data = @valid_validator_data.deep_dup
    data["ip_data"]["lat"] = "invalid"
    data["ip_data"]["lng"] = "invalid"

    ValidatorJob.new.perform(data)
    validator = Validator.last
    assert_equal 0.0, validator.lat
    assert_equal 0.0, validator.lng
  end

  test "handles numeric parsing edge cases" do
    data = @valid_validator_data.deep_dup
    
    # Test nil values
    data["votingPower"] = nil
    data["merged"]["data"]["stake_pool_active_value"] = nil
    data["merged"]["data"]["coin_store_value"] = nil
    
    ValidatorJob.new.perform(data)
    validator = Validator.last
    assert_nil validator.voting_power
    assert_nil validator.active_stake
    assert_nil validator.balance

    # Test empty string values
    data["votingPower"] = ""
    data["merged"]["data"]["stake_pool_active_value"] = ""
    data["merged"]["data"]["coin_store_value"] = ""
    
    ValidatorJob.new.perform(data)
    validator.reload
    assert_nil validator.voting_power
    assert_nil validator.active_stake
    assert_nil validator.balance
  end

  test "logs errors properly" do
    mock_logger = Minitest::Mock.new
    mock_logger.expect :error, nil, ["!!! VALIDATOR JOB FAILED !!!"]
    mock_logger.expect :error, nil, [String] # For error message
    mock_logger.expect :error, nil, [String] # For validator data
    mock_logger.expect :error, nil, [String] # For backtrace

    Rails.stub :logger, mock_logger do
      validator = Validator.new
      def validator.save!
        raise StandardError.new("Test error")
      end

      Validator.stub :new, validator do
        ValidatorJob.new.perform(@valid_validator_data)
      end
    end

    mock_logger.verify
  end

  test "logs validation warnings" do
    mock_logger = Minitest::Mock.new
    mock_logger.expect :warn, nil, ["Missing fields in validator data: address"]

    Rails.stub :logger, mock_logger do
      invalid_data = @valid_validator_data.except("address")
      ValidatorJob.new.perform(invalid_data)
    end

    mock_logger.verify
  end
end
