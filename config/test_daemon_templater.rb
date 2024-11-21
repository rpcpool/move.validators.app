require 'erb'
require 'active_support/core_ext/string/inflections'

node_env = 'production'
redis_url = 'rediss://localhost:6379'
aptos_network = 'mainnet'

 # fetch(:deploy_to) + '/current'
current_dir = '/home/deploy/move.validators.app/current'

# fetch(:systemd_service_names)[] will contain this:
js_daemon_script_filename = 'block-update-fetch.js'

# gsub .js from the end of the string
service_name = js_daemon_script_filename.gsub(/\.js$/, '')
human_readable_name = service_name.titleize




# Load the ERB template
template = File.read('config/systemd/daemon-template.service.erb')

# Create an ERB object
erb = ERB.new(template)

# Render the template with the variables
output = erb.result(binding)

# Print or save the result
puts output