# frozen_string_literal: true

require_relative '../config/environment'

include AptosLogic

# Send an interrupt with `ctrl-c` or `kill` to stop the script. Results will
# not be posted to the validators.app server.
interrupted = false
trap('INT') { interrupted = true }  unless Rails.env.test?

network = 'aptos_mainnet'
sleep_time = 15 # seconds

begin
  loop do
    pipeline = Pipeline.new(200, payload)
                       .then(&batch_set)
                       .then(&epoch_get)
                       .then(&validators_get)
                       .then(&validators_save)


    break if interrupted
  rescue SkipAndSleep => e
    break if interrupted

    if e.message.in? %w[500 502 503 504]
      sleep(1.minute)
    else
      sleep(sleep_time)
    end
  end
rescue StandardError => e
  puts "#{e.class}\n#{e.message}"
end
