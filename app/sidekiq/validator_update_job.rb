class ValidatorUpdateJob
  include Sidekiq::Job

  def perform
    validator = Validator.order("RAND()").first
    return if validator.blank?

    Rails.logger.debug "Worker fetched validator: #{validator.address}"

    ActionCable.server.broadcast "front_stats_channel", {
      type: "validator_update",
      name: validator.name,
      address: validator.address
    }

    # Schedule the next job
    # ValidatorUpdateJob.perform_in(10.seconds)
  end
end