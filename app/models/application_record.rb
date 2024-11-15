class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # Add network method to all models
  def self.network
    NETWORK
  end

  def network
    NETWORK
  end
end
