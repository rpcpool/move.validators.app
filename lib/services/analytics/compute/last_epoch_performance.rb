module Services
  module Analytics
    module Compute
      class LastEpochPerformance
        ONE_YEAR_IN_DAYS = 365.0
        CALCULATION_WINDOW_DAYS = 30 # Rolling window for calculations

        def self.call(validator)
          new(validator).call
        end

        def initialize(validator)
          @validator = validator
        end

        def call
          # Get blocks from last N days
          end_time = Time.current
          start_time = end_time - CALCULATION_WINDOW_DAYS.days

          # Get total blocks in time window
          total_blocks = Block.where(
            block_timestamp: start_time..end_time
          ).count

          return log_error("No blocks found in last #{CALCULATION_WINDOW_DAYS} days") if total_blocks.zero?

          # Get validator's blocks in same window
          validator_blocks = Block.where(
            block_timestamp: start_time..end_time,
            validator_address: @validator.address
          ).count

          # Calculate performance based on available blocks
          raw_performance = (validator_blocks.to_f / total_blocks * 100)

          # Apply age factor
          days_active = calculate_days_active

          final_score = if days_active <= ONE_YEAR_IN_DAYS
                          raw_performance * (days_active / ONE_YEAR_IN_DAYS)
                        else
                          raw_performance
                        end

          # Clamp final score between 0 and 100
          final_score = [[final_score, 0].max, 100].min

          log_computation(start_time, end_time, total_blocks, validator_blocks, raw_performance, days_active, final_score)
          final_score
        end

        private

        def calculate_days_active
          return 0 unless @validator.start_date.present?

          start = Time.parse(@validator.start_date)
          ((Time.current - start) / 1.day).round
        end

        def log_computation(start_time, end_time, total_blocks, validator_blocks, raw_performance, days_active, final_score)
          puts
          "LastEpochPerformance computation for validator #{@validator.address}:\n" \
            "  Time window: #{start_time} to #{end_time}\n" \
            "  Window size: #{CALCULATION_WINDOW_DAYS} days\n" \
            "  Total blocks in window: #{total_blocks}\n" \
            "  Validator blocks: #{validator_blocks}\n" \
            "  Raw performance: #{raw_performance.round(2)}%\n" \
            "  Days active: #{days_active}\n" \
            "  Age factor: #{days_active <= ONE_YEAR_IN_DAYS ? (days_active / ONE_YEAR_IN_DAYS).round(4) : 1.0}\n" \
            "  Final score: #{final_score.round(2)}%"
        end

        def log_error(message)
          puts "LastEpochPerformance error for validator #{@validator.address}: #{message}"
          0.0
        end
      end
    end
  end
end