# frozen_string_literal: true
require "sidekiq-unique-jobs"

Sidekiq.configure_server do |config|
  config.redis = {
    url: Rails.application.credentials.dig(Rails.env.to_sym, :redis, :url)
  }

  config.server_middleware do |chain|
    chain.add SidekiqUniqueJobs::Middleware::Server
  end

  SidekiqUniqueJobs::Server.configure(config)
end

Sidekiq.configure_client do |config|
  config.redis = {
    url: Rails.application.credentials.dig(Rails.env.to_sym, :redis, :url)
  }

  config.client_middleware do |chain|
    chain.add SidekiqUniqueJobs::Middleware::Client
  end
end