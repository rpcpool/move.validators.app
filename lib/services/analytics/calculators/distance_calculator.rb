# frozen_string_literal: true

module Services
  module Analytics
    module Calculators
      class DistanceCalculator
        include Services::Analytics::Normalizer

        def initialize(validator, validator_scope = Validator)
          @validator = validator
          @validator_scope = validator_scope
        end

        def calculate_data_center_score
          distances = calculate_distances_to_other_validators
          return 0 if distances.empty?
          return 100 if distances.length == 1 && distances.first > 0

          min_distance = distances.min
          max_distance = distances.max

          normalized_distances = distances.map do |d|
            normalize_value(d, min_distance, max_distance)
          end

          non_zero_normalized_distances = normalized_distances.reject { |d| d == 0.0 }
          non_zero_normalized_distances.min || 0
        end

        private

        def calculate_distances_to_other_validators
          other_validators = @validator_scope.where.not(id: @validator.id)

          other_validators.map do |other_validator|
            next if missing_coordinates?(other_validator)
            haversine_distance(
              @validator.lat,
              @validator.lng,
              other_validator.lat,
              other_validator.lng
            )
          end.compact
        end

        def missing_coordinates?(validator)
          validator.lat.nil? ||
            validator.lng.nil? ||
            @validator.lat.nil? ||
            @validator.lng.nil?
        end

        # Haversine formula to calculate the distance in kilometers
        def haversine_distance(lat1, lon1, lat2, lon2)
          rad_per_deg = Math::PI / 180
          rkm = 6371

          dlat_rad = (lat2 - lat1) * rad_per_deg
          dlon_rad = (lon2 - lon1) * rad_per_deg

          lat1_rad = lat1 * rad_per_deg
          lat2_rad = lat2 * rad_per_deg

          a = Math.sin(dlat_rad / 2) ** 2 +
            Math.cos(lat1_rad) *
              Math.cos(lat2_rad) *
              Math.sin(dlon_rad / 2) ** 2

          c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

          rkm * c
        end
      end
    end
  end
end