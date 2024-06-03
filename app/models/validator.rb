# == Schema Information
#
# Table name: validators
#
#  id         :bigint           not null, primary key
#  avatar_url :string(255)
#  name       :string(255)
#  network    :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
class Validator < ApplicationRecord
  # TODO: These will roll up into some compute at some point - leaving here for mvp
  attribute :scores
  attribute :active_stake
  attribute :commission
  attribute :location
  attribute :voting_power
  attribute :operator_address
  attribute :staking_address
  attribute :performance

  after_initialize :set_data

  paginates_per 10

  def set_data
    self.scores = Faker::Number.between(from: 300, to: 50000)
    self.active_stake = Faker::Number.between(from: 1000, to: 100000)
    self.commission = Faker::Number.between(from: 2, to: 12)
    self.location = "#{Faker::Address.city}, #{Faker::Address.country}"
    self.voting_power = Faker::Number.decimal(l_digits: 8, r_digits: 3)
    self.operator_address = "0x#{Faker::Crypto.md5}"
    self.staking_address = "0x#{Faker::Crypto.md5}"
    self.performance = rand(99.0..100.0).round(2)
  end

end
