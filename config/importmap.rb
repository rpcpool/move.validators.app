# Pin npm packages by running ./bin/importmap

pin "application", preload: true
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

pin "theme_toggle", to: "theme_toggle.js", preload: true

pin "@rails/actioncable", to: "@rails--actioncable.js"
pin_all_from "app/javascript/channels", under: "channels"

pin "chart.js" # @4.4.4
pin "@kurkle/color", to: "@kurkle--color.js" # @0.3.2
