# frozen_string_literal: true

module Services
  module Analytics
    module Compute
      class TotalRewards
        def self.call(validator)
          new(validator).call
        end

        def initialize(validator)
          @validator = validator
        end

        def call
          @validator.validator_rewards.sum(:amount).to_f
        end
      end
    end
  end
end