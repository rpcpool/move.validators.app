require 'redis'
require_relative '../../lib/extensions/queue/configuration'
require_relative '../../lib/extensions/queue/redis_connection'
require_relative '../../lib/extensions/queue/queue_request'

# This initializer sets up the rails -> nodejs redis queueing support. In order to send messages back to
# the nodejs side, this initializer must be configured correctly. Otherwise back fill and other jobs that
# need to round trip in this direction will not work and there could be data gaps that break the analytics.

Extensions::Queue::RedisConnection.configure do |config|
  config.redis_url = Rails.application.credentials.dig(:redis, :url)
end