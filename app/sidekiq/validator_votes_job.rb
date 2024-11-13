# frozen_string_literal: true

class ValidatorVotesJob
  include Sidekiq::Job

  def perform(voting_data)
    return if voting_data.nil?

    process_votes(voting_data)
  end

  private

  def process_votes(voting_data)
    proposal_id = voting_data["proposal_id"]
    epoch = voting_data["epoch"]
    votes = voting_data["votes"]
    timestamp = DateTime.parse(voting_data["recorded_at"])

    votes.each do |vote|
      save_vote(
        validator_address: vote["validator_address"],
        proposal_id: proposal_id,
        vote_status: vote["status"], # 'participated' or 'missed'
        recorded_at: timestamp,
        epoch: epoch
      )
    end
  end

  def save_vote(validator_address:, proposal_id:, vote_status:, recorded_at:, epoch:)
    validator_vote = ValidatorVote.find_or_initialize_by(
      validator_address: validator_address,
      proposal_id: proposal_id
    )

    is_new = validator_vote.new_record?

    validator_vote.assign_attributes(
      vote_status: vote_status,
      recorded_at: recorded_at,
      epoch: epoch
    )

    if validator_vote.save
      Rails.logger.info "#{is_new ? 'Created' : 'Updated'} vote for validator #{validator_address} on proposal #{proposal_id}"
    else
      Rails.logger.error "Failed to save vote: #{validator_vote.errors.full_messages.join(', ')}"
    end
  rescue => e
    Rails.logger.error "Error processing vote for validator #{validator_address} on proposal #{proposal_id}: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
  end
end