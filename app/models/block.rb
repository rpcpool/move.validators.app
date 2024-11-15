# frozen_string_literal: true

# == Schema Information
#
# Table name: blocks_testnet
#
#  id                :bigint           not null, primary key
#  block_hash        :string(255)      not null
#  block_height      :bigint           not null
#  block_timestamp   :datetime         not null
#  epoch             :string(255)
#  first_version     :bigint           not null
#  last_version      :bigint           not null
#  raw_data          :text(4294967295)
#  validator_address :string(255)      not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#
# Indexes
#
#  index_blocks_testnet_on_block_hash         (block_hash) UNIQUE
#  index_blocks_testnet_on_block_height       (block_height) UNIQUE
#  index_blocks_testnet_on_epoch              (epoch)
#  index_blocks_testnet_on_first_version      (first_version)
#  index_blocks_testnet_on_last_version       (last_version)
#  index_blocks_testnet_on_validator_address  (validator_address)
#
class Block < ApplicationRecord
  network_shardable
  
  has_many :transactions, foreign_key: 'block_id'

  validates :block_height, presence: true, uniqueness: true
  validates :block_hash, presence: true, uniqueness: true
  validates :block_timestamp, presence: true
  validates :first_version, presence: true
  validates :last_version, presence: true
  validates :validator_address, presence: true
end
