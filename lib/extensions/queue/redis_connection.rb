require_relative './configuration'

module Extensions
  module Queue
    class RedisConnection
      class << self
        attr_accessor :configuration

        def configure
          self.configuration ||= Configuration.new
          yield(configuration)
        end

        def client
          def client
            @client ||= Redis.new(
              url: configuration.redis_url,
              username: configuration.redis_username,
              password: configuration.redis_password,
              ssl: configuration.ssl
            )
          end
        end
      end
    end
  end
end
