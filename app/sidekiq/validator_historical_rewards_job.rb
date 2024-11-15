class ValidatorHistoricalRewardsJob
  include Sidekiq::Job

  sidekiq_options lock: :until_executed

  def perform
    puts "ValidatorHistoricalRewardsJob run"
    # Get all validator addresses
    validator_addresses = Validator.pluck(:address)

    # For each validator, enqueue a job to the pub/sub queue.rake
    validator_addresses.each do |address|
      Rails.logger.debug "> Run the rewards historical job for #{address}"
      #   # Get the earliest reward we have for this validator
      #   earliest_reward = ValidatorReward
      #     .where(validator_address: address)
      #     .order(sequence: :asc)
      #     .first
      #
      #   # Create the job payload
      #   job_payload = {
      #     validator_address: address,
      #     # If we have rewards, use the earliest sequence - 50 (or whatever limit you want)
      #     # If no rewards, start from current to get historical
      #     start_sequence: earliest_reward ? [earliest_reward.sequence.to_i - 50, 0].max : nil,
      #     limit: 50
      #   }
      #
      #   # Publish to Redis pub/sub
      #   publish_to_redis(job_payload)
    end
  end

  private

  def publish_to_redis(payload)
    redis = Redis.new(url: ENV['REDIS_URL'])

    message = {
      class: "ValidatorHistoricalRewardsJob",
      args: [payload]
    }.to_json

    # Publish to the queue.rake that Node.js is listening on
    queue_key = "queue.rake:validator_historical_rewards"
    redis.publish(queue_key, message)
  rescue Redis::BaseError => e
    Rails.logger.error "Failed to publish historical rewards job for validator #{payload[:validator_address]}: #{e.message}"
  end
end