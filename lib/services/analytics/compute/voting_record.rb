# frozen_string_literal: true

module Services
  module Analytics
    module Compute
      class VotingRecord
        def self.call(validator)
          new(validator).call
        end

        def initialize(validator)
          @validator = validator
        end

        def call
          # Parse validator start date
          start_date = parse_start_date(@validator.start_date)
          return "0 / 0" unless start_date

          # Get total proposals since validator start date
          total_proposals = ValidatorVote
            .where('recorded_at >= ?', start_date)
            .select(:proposal_id)
            .distinct
            .count

          # Get count of proposals where they participated since their start date
          participated_proposals = @validator.validator_votes
            .where(vote_status: 'participated')
            .where('recorded_at >= ?', start_date)
            .select(:proposal_id)
            .distinct
            .count

          # If no votes recorded yet, default to "0 / 0"
          return "0 / 0" if total_proposals.zero?

          # Return in format "participated / total proposals"
          "#{participated_proposals} / #{total_proposals}"
        end

        private

        def parse_start_date(date_str)
          return nil if date_str.blank?
          
          # Try parsing the date string
          begin
            Date.parse(date_str)
          rescue ArgumentError
            log_error("Invalid start date format: #{date_str}")
            nil
          end
        end

        def log_error(error)
          Rails.logger.error "Error computing voting record for validator #{@validator.address}: #{error.message}"
          Rails.logger.error error.backtrace.join("\n") if error.respond_to?(:backtrace)
        end
      end
    end
  end
end
