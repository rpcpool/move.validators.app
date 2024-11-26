module Extensions
  module Queue
    class Configuration
      attr_accessor :redis_url, :redis_username, :redis_password, :ssl
    end
  end
end