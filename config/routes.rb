require 'sidekiq/web'

Rails.application.routes.draw do
  mount ActionCable.server => '/cable'

  # TODO: Obviously, this would not be deployed on any production machine and will revisit.
  mount Sidekiq::Web => '/sidekiq' if Rails.env.development?

  devise_for :users
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  root to: 'public#home'
  resources :validators

end
