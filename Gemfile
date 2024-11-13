source "https://rubygems.org"

ruby "3.3.1"

gem 'bundler'

# Bundle edge Rails instead: gem "rails", github: "rails/rails", branch: "main"
gem "rails", "~> 7.1.3", ">= 7.1.3.2"

# The original asset pipeline for Rails [https://github.com/rails/sprockets-rails]
gem "sprockets-rails"

# Use mysql as the database for Active Record
gem "mysql2", "0.5.6"

# Use the Puma web server [https://github.com/puma/puma]
gem "puma", ">= 5.0"

# Use JavaScript with ESM import maps [https://github.com/rails/importmap-rails]
gem "importmap-rails"

# Hotwire's SPA-like page accelerator [https://turbo.hotwired.dev]
gem "turbo-rails"

# Hotwire's modest JavaScript framework [https://stimulus.hotwired.dev]
gem "stimulus-rails"

# Use Tailwind CSS [https://github.com/rails/tailwindcss-rails]
gem "tailwindcss-rails"

# Build JSON APIs with ease [https://github.com/rails/jbuilder]
gem "jbuilder"

# Use Redis adapter to run Action Cable in production
gem "redis", ">= 4.0.1"

# Use Kredis to get higher-level data types in Redis [https://github.com/rails/kredis]
# gem "kredis"

# Use Active Model has_secure_password [https://guides.rubyonrails.org/active_model_basics.html#securepassword]
# gem "bcrypt", "~> 3.1.7"

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ mswin mswin64 mingw x64_mingw jruby ]

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Use Active Storage variants [https://guides.rubyonrails.org/active_storage_overview.html#transforming-images]
# gem "image_processing", "~> 1.2"

gem 'sidekiq'
gem 'sidekiq-scheduler'
gem 'sidekiq-unique-jobs'

gem 'devise'
gem 'paper_trail'
gem 'paranoia'
gem 'faraday'
gem 'coingecko_ruby'
gem 'kaminari'
gem "image_processing", ">= 1.2"

# Capistrano & deployments
gem 'capistrano', '3.16.0'
gem 'capistrano-passenger'
gem 'capistrano-rails', group: :development
gem 'capistrano-sidekiq', require: false
gem 'ed25519'
gem 'bcrypt_pbkdf'
gem 'appsignal'
gem 'httparty'

# NOTE: This template allows you to choose between encryption with the
# `attr_encrypted` gem or Vault. Vault is more secure but is harder to
# configure in production.
#
# User data encryption
gem 'attr_encrypted', '>= 4.0'

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "debug", platforms: %i[ mri mswin mswin64 mingw x64_mingw ]
  gem 'faker'
  gem 'pry'
  gem 'bullet'
  gem 'autotest'
  gem 'autotest-fsevent'
end

group :development do
  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem "web-console"

  # Add speed badges [https://github.com/MiniProfiler/rack-mini-profiler]
  # gem "rack-mini-profiler"

  # Speed up commands on slow machines / big apps [https://github.com/rails/spring]
  # gem "spring"

  gem 'letter_opener_web'
  gem 'annotate'

  # Use the Solargraph gem for zed editor support [https://solargraph.org/]
  gem 'solargraph', group: :development
end

group :test do
  # Use system testing [https://guides.rubyonrails.org/testing.html#system-testing]
  gem "capybara"
  gem "selenium-webdriver"
end
