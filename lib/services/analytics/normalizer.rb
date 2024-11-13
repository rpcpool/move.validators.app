# frozen_string_literal: true

module Services
  module Analytics
    module Normalizer
      def self.included(base)
        base.extend(ClassMethods)
        base.include(InstanceMethods)
      end

      module ClassMethods
        def normalize_value(value, min, max)
          return 0 if max == min # Avoid division by zero
          ((value - min).to_f / (max - min) * 100).round(2)
        end

        def normalize_date(date, max_date, min_date)
          # Calculate the difference in days between max, min, and the given date
          total_days = (min_date - max_date).to_f
          days_from_min = (min_date - date).to_f

          # Normalize to a 0-100 scale (older dates get higher scores)
          ((days_from_min / total_days) * 100).round(2)
        end

        def parse_date(date)
          Date.parse(date) rescue Date.today # Fallback to today's date if parsing fails
        end
      end

      module InstanceMethods
        def normalize_value(value, min, max)
          self.class.normalize_value(value, min, max)
        end

        def normalize_date(date, max_date, min_date)
          self.class.normalize_date(date, max_date, min_date)
        end

        def parse_date(date)
          self.class.parse_date(date)
        end
      end
    end
  end
end