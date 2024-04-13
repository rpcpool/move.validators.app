# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

# pin "vue" # @3.4.21

pin "@rails/actioncable", to: "@rails--actioncable.js"
pin_all_from "app/javascript/channels", under: "channels"
