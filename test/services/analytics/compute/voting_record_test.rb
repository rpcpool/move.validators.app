require "test_helper"

module Services
  module Analytics
    module Compute
      class VotingRecordTest < ActiveSupport::TestCase
        def setup
          @validator = Validator.create!(
            address: "0x" + "a" * 64,
            name: "Test Validator"
          )
          @compute = VotingRecord.new(@validator)
        end

        test "returns '0 / 0' when no votes exist" do
          assert_equal "0 / 0", @compute.call
        end

        test "calculates complete voting record" do
          create_vote("proposal_1", "participated")
          create_vote("proposal_2", "participated")
          create_vote("proposal_3", "participated")

          assert_equal "3 / 3", @compute.call
        end

        test "calculates partial participation" do
          create_vote("proposal_1", "participated")
          create_vote("proposal_2", "missed")
          create_vote("proposal_3", "participated")

          assert_equal "2 / 3", @compute.call
        end

        test "handles zero participation" do
          create_vote("proposal_1", "missed")
          create_vote("proposal_2", "missed")

          assert_equal "0 / 2", @compute.call
        end

        test "counts each proposal only once" do
          # Create multiple votes for same proposal
          create_vote("proposal_1", "participated")
          create_vote("proposal_1", "participated")
          create_vote("proposal_2", "missed")

          assert_equal "1 / 2", @compute.call
        end

        test "calculates correctly with multiple validators" do
          other_validator = Validator.create!(
            address: "0x" + "b" * 64,
            name: "Other Validator"
          )

          # Create votes for main validator
          create_vote("proposal_1", "participated")
          create_vote("proposal_2", "missed")

          # Create votes for other validator
          create_vote("proposal_1", "participated", other_validator)
          create_vote("proposal_2", "participated", other_validator)
          create_vote("proposal_3", "participated", other_validator)

          # Should show "1 / 3" as there are 3 total proposals but our validator only participated in 1
          assert_equal "1 / 3", @compute.call
        end

        test "class method produces same result as instance method" do
          create_vote("proposal_1", "participated")
          create_vote("proposal_2", "missed")

          assert_equal VotingRecord.new(@validator).call,
                       VotingRecord.call(@validator)
        end

        test "handles duplicate proposal votes" do
          # Create multiple votes for same proposal with different statuses
          create_vote("proposal_1", "participated")
          create_vote("proposal_1", "missed")
          create_vote("proposal_2", "participated")

          assert_equal "2 / 2", @compute.call
        end

        test "considers only participated status" do
          create_vote("proposal_1", "participated")
          create_vote("proposal_2", "missed")
          create_vote("proposal_3", "invalid_status")

          assert_equal "1 / 3", @compute.call
        end

        private

        def create_vote(proposal_id, status, validator = @validator)
          ValidatorVote.create!(
            validator_address: validator.address,
            proposal_id: proposal_id,
            vote_status: status,
            epoch: "100",
            recorded_at: Time.current
          )
        end
      end
    end
  end
end