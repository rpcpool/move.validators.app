require "test_helper"

module Services
  module Analytics
    module Calculators
      class VotingCalculatorTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator"
          )
          @calculator = VotingCalculator.new(@validator)
          @today = Date.today
        end

        # Voting Record Tests
        test "calculates correct voting record percentage" do
          create_votes(5, 'participated', @today)
          create_votes(5, 'missed', @today)

          assert_equal 50.0, @calculator.calculate_voting_record
        end

        test "returns 0 for no votes" do
          assert_equal 0.0, @calculator.calculate_voting_record
        end

        test "calculates 100% participation" do
          create_votes(10, 'participated', @today)
          assert_equal 100.0, @calculator.calculate_voting_record
        end

        test "calculates 0% participation" do
          create_votes(10, 'missed', @today)
          assert_equal 0.0, @calculator.calculate_voting_record
        end

        test "rounds to two decimal places" do
          create_votes(2, 'participated', @today)
          create_votes(1, 'missed', @today)
          assert_equal 66.67, @calculator.calculate_voting_record
        end

        # Date Range Tests
        test "respects date range filters" do
          # Create votes for different days
          create_votes(5, 'participated', @today)
          create_votes(5, 'missed', @today)
          create_votes(10, 'participated', @today - 1.day)

          result = @calculator.calculate_voting_record(@today, @today)
          assert_equal 50.0, result
        end

        test "handles empty date range" do
          result = @calculator.calculate_voting_record(@today + 1.day, @today + 2.day)
          assert_equal 0.0, result
        end

        test "includes full day in calculations" do
          create_votes(1, 'participated', @today.beginning_of_day)
          create_votes(1, 'participated', @today.end_of_day)

          result = @calculator.calculate_voting_record(@today, @today)
          assert_equal 100.0, result
        end

        # Period Participation Rate Tests
        test "calculates correct period participation" do
          create_votes(8, 'participated', @today)
          create_votes(2, 'missed', @today)

          rate = @calculator.period_participation_rate(@today, @today)
          assert_equal 80.0, rate
        end

        test "handles empty period" do
          rate = @calculator.period_participation_rate(@today + 1.day, @today + 2.day)
          assert_equal 0.0, rate
        end

        test "calculates rate across multiple days" do
          create_votes(5, 'participated', @today)
          create_votes(5, 'missed', @today - 1.day)

          rate = @calculator.period_participation_rate(@today - 1.day, @today)
          assert_equal 50.0, rate
        end

        # Voting Trend Tests
        test "generates correct number of days in trend" do
          days = 7
          trend = @calculator.voting_trend(days)
          assert_equal days, trend.length
        end

        test "orders trend data from oldest to newest" do
          trend = @calculator.voting_trend(3)
          dates = trend.map { |t| t[:date] }
          assert_equal dates, dates.sort
        end

        test "calculates correct daily rates in trend" do
          # Create different participation rates for three days
          create_votes(9, 'participated', @today)
          create_votes(1, 'missed', @today)

          create_votes(8, 'participated', @today - 1.day)
          create_votes(2, 'missed', @today - 1.day)

          create_votes(7, 'participated', @today - 2.day)
          create_votes(3, 'missed', @today - 2.day)

          trend = @calculator.voting_trend(3)

          assert_equal 90.0, trend.last[:rate]
          assert_equal 80.0, trend[-2][:rate]
          assert_equal 70.0, trend.first[:rate]
        end

        test "handles days with no votes in trend" do
          trend = @calculator.voting_trend(3)
          trend.each do |day|
            assert_equal 0.0, day[:rate]
          end
        end

        test "includes today in trend data" do
          trend = @calculator.voting_trend(1)
          assert_equal @today, trend.first[:date].to_date
        end

        private

        def create_votes(count, status, date)
          count.times do |i|
            ValidatorVote.create!(
              validator_address: @validator.address,
              vote_status: status,
              recorded_at: date,
              epoch: "100",
              proposal_id: "proposal_#{date}_#{i}"
            )
          end
        end
      end
    end
  end
end