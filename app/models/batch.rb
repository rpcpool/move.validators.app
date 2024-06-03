# == Schema Information
#
# Table name: batches
#
#  id               :bigint           not null, primary key
#  gathered_at      :datetime
#  network          :string(255)
#  scored_at        :datetime
#  software_version :string(255)
#  uuid             :string(255)
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#
class Batch < ApplicationRecord
  before_create :create_uuid

  validates :gathered_at, presence: true
  validates :network, presence: true
  validates :scored_at, presence: true
  validates :software_version, presence: true
  validates :uuid, presence: true

  private

  def create_uuid
    self.uuid = SecureRandom.uuid
  end
end
