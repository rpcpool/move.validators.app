namespace :queue do
  desc "Test queue communication with echo daemon"
  task echo_test: :environment do
    test_data = {
      message: "Hello from Rails",
      timestamp: Time.current.to_i
    }

    Extensions::Queue::QueueRequest.push("EchoRequest", test_data)
    puts "Sent test message to EchoRequest queue with data: #{test_data}"
  end
end