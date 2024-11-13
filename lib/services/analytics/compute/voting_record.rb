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
          # Get total unique proposals from the entire table
          total_proposals = ValidatorVote.distinct.count(:proposal_id)

          # Get count of proposals where they participated
          participated_proposals = @validator.validator_votes
                                             .where(vote_status: 'participated')
                                             .select(:proposal_id)
                                             .distinct
                                             .count

          # If no votes recorded yet, default to "0 / 0"
          return "0 / 0" if total_proposals.zero?

          # Return in format "participated / total proposals"
          "#{participated_proposals} / #{total_proposals}"
        end

        private

        def log_error(error)
          Rails.logger.error "Error computing voting record for validator #{@validator.address}: #{error.message}"
          Rails.logger.error error.backtrace.join("\n")
        end
      end
    end
  end
end