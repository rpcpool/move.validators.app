require 'sidekiq/web'

Rails.application.routes.draw do
  mount ActionCable.server => '/cable'

  unless Rails.env.development?
    Sidekiq::Web.use Rack::Auth::Basic, "Protected Area" do |username, password|
      username == Rails.application.credentials.sidekiq[:ui_username] &&
            password == Rails.application.credentials.sidekiq[:ui_password]
    end
  end

  mount Sidekiq::Web => '/sidekiq'

  devise_for :users
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # So chartjs will work
  get "/_/:filename", to: "assets#serve_js", constraints: { filename: /.*\.js/ }

  root to: 'public#home'

  resources :validators, only: [:index, :show] do
    member do
      get :rewards
      get :analytics
      get :performance_metrics
      get :rewards_history
      get :rewards_growth
      get :balance_vs_rewards
      get :block_production
      get :active_stake_history
    end
  end

end
