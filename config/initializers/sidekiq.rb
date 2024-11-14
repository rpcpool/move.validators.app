# frozen_string_literal: true
require "sidekiq-unique-jobs"

conf = {
  url: Rails.application.credentials.dig(Rails.env.to_sym, :redis, :url)
}

if Rails.env.production?
  conf.merge!(
    username: Rails.application.credentials.dig(Rails.env.to_sym, :redis, :username),
    password: Rails.application.credentials.dig(Rails.env.to_sym, :redis, :password)
  )
end

Sidekiq.configure_server do |config|
  config.redis = conf
  config.server_middleware do |chain|
    chain.add SidekiqUniqueJobs::Middleware::Server
  end

  SidekiqUniqueJobs::Server.configure(config)
end

Sidekiq.configure_client do |config|
  config.redis = conf

  config.client_middleware do |chain|
    chain.add SidekiqUniqueJobs::Middleware::Client
  end
end
