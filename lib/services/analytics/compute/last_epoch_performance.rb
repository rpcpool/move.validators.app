# frozen_string_literal: true

module Services
  module Analytics
    module Compute
      class LastEpochPerformance
        ONE_YEAR_IN_DAYS = 365.0

        def self.call(validator)
          new(validator).call
        end

        def initialize(validator)
          @validator = validator
        end

        def call
          current_epoch = Block.maximum(:epoch)
          return log_error("No epochs found in blocks table") unless current_epoch

          last_epoch = current_epoch - 1

          # Get performance numbers based on available blocks
          total_blocks = Block.where(epoch: last_epoch).count
          return log_error("No blocks found for epoch #{last_epoch}") if total_blocks.zero?

          validator_blocks = Block.where(
            epoch: last_epoch,
            validator_address: @validator.address
          ).count

          # Calculate raw performance percentage
          raw_performance = (validator_blocks.to_f / total_blocks * 100)

          # Apply age factor
          days_active = calculate_days_active

          final_score = if days_active <= ONE_YEAR_IN_DAYS
                          # For validators less than 1 year old
                          raw_performance * (days_active / ONE_YEAR_IN_DAYS)
                        else
                          # For validators over 1 year
                          raw_performance
                        end

          # Clamp final score between 0 and 100
          final_score = [[final_score, 0].max, 100].min

          log_computation(current_epoch, last_epoch, total_blocks, validator_blocks, raw_performance, days_active, final_score)
          final_score
        end

        private

        def calculate_days_active
          return 0 unless @validator.start_date.present?

          start = Time.parse(@validator.start_date)
          ((Time.current - start) / 1.day).round
        end

        def log_computation(current_epoch, last_epoch, total_blocks, validator_blocks, score, days_active)
          # Rails.logger.info(

          puts
          "LastEpochPerformance computation for validator #{@validator.address}:\n" \
            "  Current epoch: #{current_epoch}\n" \
            "  Last epoch: #{last_epoch}\n" \
            "  Total blocks in epoch: #{total_blocks}\n" \
            "  Validator blocks: #{validator_blocks}\n" \
            "  Days active: #{days_active}\n" \
            "  Final score: #{score.round(2)}%"
        end

        def log_error(message)
          # Rails.logger.error(
          #   "LastEpochPerformance error for validator #{@validator.address}: #{message}"
          # )
          puts "LastEpochPerformance error for validator #{@validator.address}: #{message}"
          0.0
        end
      end
    end
  end
end