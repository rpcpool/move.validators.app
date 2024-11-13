require "test_helper"

module Services
  module Analytics
    module Calculators
      class DistanceCalculatorTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            lat: 40.7128, # New York
            lng: -74.0060,
            address: "0x" + "a" * 64,
            name: "NYC Validator"
          )

          @calculator = DistanceCalculator.new(@validator)
        end

        # Basic functionality tests
        test "initializes with a validator" do
          assert_not_nil @calculator
          assert_instance_of DistanceCalculator, @calculator
        end

        test "returns 0 when there are no other validators" do
          assert_equal 0, @calculator.calculate_data_center_score
        end

        test "returns 100 when there is only one other validator and it's far away" do
          Validator.create!(
            lat: -33.8688, # Sydney
            lng: 151.2093,
            address: "0x" + "b" * 64,
            name: "Sydney Validator"
          )

          assert_equal 100, @calculator.calculate_data_center_score
        end

        # Distance calculation tests
        test "calculates correct distances between known cities" do
          # Create validators in different cities
          london = Validator.create!(
            lat: 51.5074,
            lng: -0.1278,
            address: "0x" + "b" * 64,
            name: "London Validator"
          )

          tokyo = Validator.create!(
            lat: 35.6762,
            lng: 139.6503,
            address: "0x" + "c" * 64,
            name: "Tokyo Validator"
          )

          calculator = DistanceCalculator.new(london)
          distances = calculator.send(:calculate_distances_to_other_validators)

          # Known approximate distances
          london_to_nyc = 5570 # km
          london_to_tokyo = 9560 # km

          distances.each do |distance|
            assert_in_delta(distance, london_to_nyc, 100) if distance < 6000
            assert_in_delta(distance, london_to_tokyo, 100) if distance > 9000
          end
        end

        # Edge cases and special scenarios
        test "handles missing coordinates" do
          Validator.create!(
            lat: nil,
            lng: nil,
            address: "0x" + "b" * 64,
            name: "Invalid Validator"
          )

          assert_equal 0, @calculator.calculate_data_center_score
        end

        test "handles same location validators" do
          Validator.create!(
            lat: @validator.lat,
            lng: @validator.lng,
            address: "0x" + "b" * 64,
            name: "Same Location Validator"
          )

          assert_equal 0, @calculator.calculate_data_center_score
        end

        test "handles validators at opposite sides of the world" do
          Validator.create!(
            lat: -@validator.lat,
            lng: -(@validator.lng + 180),
            address: "0x" + "b" * 64,
            name: "Antipode Validator"
          )

          score = @calculator.calculate_data_center_score
          assert_equal 100, score
        end

        # Custom validator scope tests
        test "respects custom validator scope" do
          custom_scope = Validator.where(name: "Custom Scope Validator")
          calculator = DistanceCalculator.new(@validator, custom_scope)

          assert_equal 0, calculator.calculate_data_center_score

          Validator.create!(
            lat: 51.5074,
            lng: -0.1278,
            address: "0x" + "b" * 64,
            name: "Custom Scope Validator"
          )

          assert_equal 100, calculator.calculate_data_center_score
        end

        # Normalization tests
        test "normalizes distances correctly" do
          # Create three validators at increasing distances
          close_validator = Validator.create!(
            lat: 40.7500, # Very close to NYC
            lng: -73.9500,
            address: "0x" + "b" * 64,
            name: "Close Validator"
          )

          medium_validator = Validator.create!(
            lat: 51.5074, # London
            lng: -0.1278,
            address: "0x" + "c" * 64,
            name: "Medium Validator"
          )

          far_validator = Validator.create!(
            lat: -33.8688, # Sydney
            lng: 151.2093,
            address: "0x" + "d" * 64,
            name: "Far Validator"
          )

          score = @calculator.calculate_data_center_score
          assert_includes 0..100, score
          assert score > 0, "Score should be greater than 0 with multiple validators"
        end

        # Haversine formula specific tests
        test "haversine distance calculation is accurate" do
          # Test with known distances
          ny_to_la_distance = @calculator.send(
            :haversine_distance,
            40.7128, -74.0060, # NYC
            34.0522, -118.2437 # LA
          )

          assert_in_delta 3935, ny_to_la_distance, 50 # ~3935 km with 50km margin
        end

        test "haversine distance is symmetric" do
          point1 = [40.7128, -74.0060] # NYC
          point2 = [51.5074, -0.1278] # London

          distance1 = @calculator.send(:haversine_distance, *point1, *point2)
          distance2 = @calculator.send(:haversine_distance, *point2, *point1)

          assert_in_delta distance1, distance2, 0.001
        end

        test "haversine distance handles edge cases" do
          # Same point should have zero distance
          distance = @calculator.send(:haversine_distance, 0, 0, 0, 0)
          assert_equal 0, distance

          # Antipodes should be about 20,000 km apart
          distance = @calculator.send(:haversine_distance, 0, 0, 0, 180)
          assert_in_delta 20015, distance, 50
        end
      end
    end
  end
end