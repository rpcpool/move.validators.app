module Extensions
  module Queue
    class QueueRequest
      class << self
        def push(job_name, data)
          payload = {
            class: job_name,
            jid: generate_jid,
            queue: "queue:#{job_name.underscore}",
            args: [data]
          }

          redis_client.lpush(payload[:queue], payload.to_json)
          redis_client.sadd("queues", payload[:queue])
        end

        private

        def redis_client
          RedisConnection.client
        end

        def generate_jid
          SecureRandom.hex(12)
        end
      end
    end
  end
end