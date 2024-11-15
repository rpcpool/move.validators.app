require_relative './configuration'

module Extensions
  module Queue
    class RedisConnection
      class << self
        attr_accessor :configuration

        def configure
          self.configuration ||= Extensions::Queue::Configuration.new
          yield(configuration)
        end

        def client
          @client ||= Redis.new(url: configuration.redis_url)
        end
      end
    end
  end
end
