# frozen_string_literal: true

module Services
  module Analytics
    module Calculators
      class VotingCalculator
        include Services::Analytics::Normalizer

        def initialize(validator)
          @validator = validator
        end

        def calculate_voting_record(start_date = nil, end_date = nil)
          scope = @validator.validator_votes
          scope = scope.where(recorded_at: start_date.beginning_of_day..end_date.end_of_day) if start_date && end_date

          total_votes = scope.count
          participated_votes = scope.where(vote_status: 'participated').count

          return 0.0 if total_votes.zero?
          (participated_votes.to_f / total_votes * 100).round(2)
        end

        def period_participation_rate(start_date, end_date)
          calculate_voting_record(start_date, end_date)
        end

        def voting_trend(days = 30)
          # Calculate daily participation rates for trend analysis
          rates = []
          days.times do |i|
            date = i.days.ago
            rates << {
              date: date,
              rate: calculate_voting_record(date.beginning_of_day, date.end_of_day)
            }
          end
          rates.reverse
        end
      end
    end
  end
end