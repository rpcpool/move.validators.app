import {Application} from "@hotwired/stimulus"

const application = Application.start()

// Configure Stimulus development experience
application.debug = true
window.Stimulus = application

import "chart.js"

export {application}
