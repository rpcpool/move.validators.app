Rails.logger.info "Environment Variables as seen by Passenger at startup:"
ENV.each do |key, value|
  Rails.logger.info "#{key}=#{value}"
end
