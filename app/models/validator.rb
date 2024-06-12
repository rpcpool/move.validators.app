# == Schema Information
#
# Table name: validators_testnet
#
#  id                   :bigint           not null, primary key
#  address              :string(255)
#  avatar_url           :string(255)
#  consensus_public_key :string(255)
#  domain               :string(255)
#  fullnode_address     :string(255)
#  name                 :string(255)
#  network_address      :string(255)
#  validator_index      :integer
#  voting_power         :string(255)
#  created_at           :datetime         not null
#  updated_at           :datetime         not null
#
# Indexes
#
#  index_validators_testnet_on_address  (address)
#
class Validator < ApplicationRecord
  network_shardable

  # TODO: These will roll up into some compute at some point - leaving here for mvp
  attribute :scores
  attribute :active_stake
  attribute :commission
  attribute :location
  attribute :operator_address
  attribute :staking_address
  attribute :performance

  before_create :set_faker_avatar_url
  after_initialize :set_data

  has_one_attached :avatar

  # validates :name, presence: true

  paginates_per 10

  # TODO: To be removed later
  def set_data
    self.scores = Faker::Number.between(from: 300, to: 50_000) unless scores.present?
    self.active_stake = Faker::Number.between(from: 1000, to: 100_000)  unless active_stake.present?
    self.commission = Faker::Number.between(from: 2, to: 12)  unless commission.present?
    self.location = "#{Faker::Address.city}, #{Faker::Address.country}"  unless location.present?
    self.operator_address = "0x#{Faker::Crypto.md5}"  unless operator_address.present?
    self.staking_address = "0x#{Faker::Crypto.md5}"  unless staking_address.present?
    self.performance = rand(99.0..100.0).round(2)  unless performance.present?
  end

  private

  def set_faker_avatar_url
    self.avatar_url = Faker::Avatar.image if avatar_url.blank?
  end
end
