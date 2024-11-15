require_relative './configuration'

module Extensions
  module Queue
    module RedisConnection
      class << self
        attr_accessor :configuration

        def configure
          self.configuration ||= Configuration.new
          yield(configuration)
        end

        def client
          @client ||= Redis.new(url: configuration.redis_url)
        end
      end
    end
  end
end