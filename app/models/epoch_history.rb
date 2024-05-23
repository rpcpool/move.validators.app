# == Schema Information
#
# Table name: epoch_histories
#
#  id                    :bigint           not null, primary key
#  batch_uuid            :string(255)
#  block_height          :string(255)
#  epoch                 :string(255)
#  git_hash              :string(255)
#  ledger_timestamp      :string(255)
#  ledger_version        :string(255)
#  network               :string(255)
#  node_role             :string(255)
#  oldest_block_height   :string(255)
#  oldest_ledger_version :string(255)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
class EpochHistory < ApplicationRecord
end
