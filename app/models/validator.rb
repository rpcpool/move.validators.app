# == Schema Information
#
# Table name: validators_testnet
#
#  id                    :bigint           not null, primary key
#  active_stake          :string(255)
#  address               :string(255)
#  avatar_url            :string(255)
#  balance               :string(255)
#  blocks_purposed_day   :integer
#  blocks_purposed_month :integer
#  blocks_purposed_week  :integer
#  city                  :string(255)
#  consensus_public_key  :string(255)
#  country               :string(255)
#  country_code          :string(255)
#  data_center_score     :float(24)
#  domain                :string(255)
#  failed_blocks         :string(255)
#  fullnode_address      :string(255)
#  ip_address            :string(255)
#  last_epoch_perf       :string(255)
#  last_epoch_score      :float(24)
#  lat                   :decimal(10, 6)
#  lng                   :decimal(10, 6)
#  name                  :string(255)
#  network_address       :string(255)
#  overall_score         :float(24)
#  performance           :float(24)
#  region                :string(255)
#  rewards               :string(255)
#  rewards_growth        :float(24)
#  start_date            :string(255)
#  successful_blocks     :string(255)
#  timezone              :string(255)
#  validator_index       :integer
#  voting_power          :string(255)
#  voting_record         :string(255)
#  voting_record_score   :float(24)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_validators_testnet_on_address  (address)
#
class Validator < ApplicationRecord
  include Services::Analytics::Normalizer
  network_shardable

  # Attributes for future use
  attribute :scores
  attribute :commission

  before_create :set_faker_avatar_url
  after_initialize :set_data
  before_save :update_data_center_score, :calculate_scores, :calculate_performance_score

  has_one_attached :avatar
  has_many :validator_rewards, foreign_key: :validator_address, primary_key: :address
  has_many :validator_votes, foreign_key: :validator_address, primary_key: :address
  has_many :validator_rewards, foreign_key: :validator_address, primary_key: :address
  has_many :blocks, foreign_key: :validator_address, primary_key: :address

  # I really didn't like this and probably a has_many_shardable helper needs to be added
  has_many :stake_histories,
           -> { where(nil) },
           foreign_key: "validators_#{network}_id",
           class_name: 'StakeHistory'

  paginates_per 10

  APTOS_START_DATE = Date.parse('2022-10-12')

  # Sets random data for MVP purposes
  def set_data
    self.blocks_purposed_day ||= rand(800.0..2000.0).round(2)
    self.blocks_purposed_week ||= (blocks_purposed_day * 7).round(2)
    self.blocks_purposed_month ||= (blocks_purposed_day * 30.44).round(2)
  end

  # Updates the data center score before saving
  def update_data_center_score
    self.data_center_score = calculate_distance_score
  end

  def location
    return "" if city.blank? && country.blank?
    return "#{country}" if city.blank?
    "#{city}, #{country}"
  end

  def voting_record_percent
    return 0 if voting_record.nil? || voting_record.empty?

    numerator, denominator = voting_record.split(' / ').map(&:to_i)
    return 0 if denominator.nil? || denominator.zero?

    percentage = (numerator.to_f / denominator * 100).round
    [percentage, 100].min
  end

  # Calculates the start_date_score (0-100)
  def start_date_score
    # Ensure start_date is a Date object
    start_date_parsed = parse_date(start_date)

    # Use Aptos start as the max date and today as the min date
    max_date = APTOS_START_DATE
    min_date = Date.today

    # Clamp the start date to the valid range
    start_date_clamped = start_date_parsed.clamp(max_date, min_date)

    # Normalize the start date, giving older dates higher scores
    normalize_date(start_date_clamped, max_date, min_date)
  end

  private

  def set_faker_avatar_url
    self.avatar_url = Faker::Avatar.image if avatar_url.blank? && (Rails.env.test? || Rails.env.development?)
  end

  def update_data_center_score
    self.data_center_score = Services::Analytics::Metrics::ValidatorMetrics.new(self).data_center_score
  end

  def calculate_scores
    metrics = Services::Analytics::Metrics::ValidatorMetrics.new(self)

    self.voting_record_score = metrics.voting_record_score || 0
    self.last_epoch_score = metrics.last_epoch_score || 0
    self.overall_score = metrics.overall_score || 0
  end

  def calculate_performance_score
    self.performance = Services::Analytics::Metrics::ValidatorMetrics.new(self).performance_score
  end

  def weekly_performance_metrics(weeks_back = 3)
    Services::Analytics::Metrics::ValidatorMetrics.new(self).weekly_performance_metrics(weeks_back)
  end

end
