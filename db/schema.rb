# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2024_11_14_194555) do
  create_table "active_storage_attachments", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "batches", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.datetime "gathered_at"
    t.string "network"
    t.datetime "scored_at"
    t.string "software_version"
    t.string "uuid"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "blocks_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.bigint "block_height", null: false
    t.string "block_hash", null: false
    t.datetime "block_timestamp", null: false
    t.bigint "first_version", null: false
    t.bigint "last_version", null: false
    t.string "validator_address", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "raw_data", size: :long
    t.string "epoch"
    t.index ["block_hash"], name: "index_blocks_testnet_on_block_hash", unique: true
    t.index ["block_height"], name: "index_blocks_testnet_on_block_height", unique: true
    t.index ["epoch"], name: "index_blocks_testnet_on_epoch"
    t.index ["first_version"], name: "index_blocks_testnet_on_first_version"
    t.index ["last_version"], name: "index_blocks_testnet_on_last_version"
    t.index ["validator_address"], name: "index_blocks_testnet_on_validator_address"
  end

  create_table "epoch_histories_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "batch_uuid"
    t.integer "epoch"
    t.string "ledger_version"
    t.string "oldest_ledger_version"
    t.string "ledger_timestamp"
    t.string "node_role"
    t.string "oldest_block_height"
    t.string "block_height"
    t.string "git_hash"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "epochs_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.integer "epoch"
    t.bigint "starting_slot"
    t.integer "slots_in_epoch"
    t.bigint "total_stake"
    t.bigint "avg_validator_staked"
    t.bigint "total_rewards"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["epoch"], name: "index_epochs_testnet_on_epoch", unique: true
  end

  create_table "prices", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "currency"
    t.decimal "price", precision: 20, scale: 10
    t.decimal "daily_change", precision: 10, scale: 4
    t.decimal "daily_volume", precision: 20, scale: 2
    t.string "coin"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["currency", "created_at"], name: "index_prices_on_currency_and_created_at", order: { created_at: :desc }
  end

  create_table "transactions_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "txn_version"
    t.string "txn_hash"
    t.string "state_change_hash"
    t.string "event_root_hash"
    t.string "state_checkpoint_hash"
    t.string "gas_used"
    t.boolean "success"
    t.string "vm_status"
    t.string "accumulator_root_hash"
    t.string "epoch"
    t.string "round"
    t.string "proposer"
    t.bigint "timestamp"
    t.json "txn_changes"
    t.json "txn_events"
    t.json "failed_proposer_indices"
    t.json "previous_block_votes_bitvec"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "blocks_testnet_id"
    t.index ["blocks_testnet_id"], name: "fk_rails_81e5829f0a"
    t.index ["txn_hash"], name: "index_transactions_testnet_on_txn_hash", unique: true
    t.index ["txn_version"], name: "index_transactions_testnet_on_txn_version", unique: true
  end

  create_table "users", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "username", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.integer "sign_in_count", default: 0, null: false
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "last_sign_in_ip"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.integer "failed_attempts", default: 0, null: false
    t.string "unlock_token"
    t.datetime "locked_at"
    t.boolean "is_admin", default: false
    t.string "email_encrypted"
    t.string "email_hash"
    t.string "email_encrypted_iv"
    t.string "api_token"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["api_token"], name: "index_users_on_api_token", unique: true
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["unlock_token"], name: "index_users_on_unlock_token", unique: true
    t.index ["username"], name: "index_users_on_username", unique: true
  end

  create_table "validator_balances_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "validator_address", null: false
    t.string "total_balance", null: false
    t.string "staked_amount", null: false
    t.string "available_amount", null: false
    t.datetime "recorded_at", null: false
    t.string "epoch", null: false
    t.bigint "version", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["epoch"], name: "index_validator_balances_testnet_on_epoch"
    t.index ["recorded_at"], name: "index_validator_balances_testnet_on_recorded_at"
    t.index ["validator_address"], name: "index_validator_balances_testnet_on_validator_address"
    t.index ["version"], name: "index_validator_balances_testnet_on_version"
  end

  create_table "validator_rewards_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "validator_address", null: false
    t.bigint "version", null: false
    t.bigint "sequence", null: false
    t.string "amount", null: false
    t.bigint "block_height", null: false
    t.string "block_timestamp", null: false
    t.datetime "reward_datetime", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["reward_datetime"], name: "index_validator_rewards_testnet_on_reward_datetime"
    t.index ["validator_address", "version"], name: "idx_on_validator_address_version_1d96c16337", unique: true
    t.index ["validator_address"], name: "index_validator_rewards_testnet_on_validator_address"
    t.index ["version"], name: "index_validator_rewards_testnet_on_version"
  end

  create_table "validator_stakes_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "validator_address", null: false
    t.bigint "version", null: false
    t.string "amount", null: false
    t.datetime "recorded_at", null: false
    t.string "epoch", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["epoch"], name: "index_validator_stakes_testnet_on_epoch"
    t.index ["recorded_at"], name: "index_validator_stakes_testnet_on_recorded_at"
    t.index ["validator_address", "version"], name: "idx_on_validator_address_version_b864e2f567", unique: true
    t.index ["validator_address"], name: "index_validator_stakes_testnet_on_validator_address"
    t.index ["version"], name: "index_validator_stakes_testnet_on_version"
  end

  create_table "validator_votes_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "validator_address", null: false
    t.string "proposal_id", null: false
    t.string "vote_status", null: false
    t.datetime "recorded_at", null: false
    t.string "epoch", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["epoch"], name: "index_validator_votes_testnet_on_epoch"
    t.index ["proposal_id"], name: "index_validator_votes_testnet_on_proposal_id"
    t.index ["recorded_at"], name: "index_validator_votes_testnet_on_recorded_at"
    t.index ["validator_address", "proposal_id"], name: "idx_on_validator_address_proposal_id_c7e1376f72", unique: true
    t.index ["validator_address"], name: "index_validator_votes_testnet_on_validator_address"
  end

  create_table "validators_testnet", charset: "utf8mb4", collation: "utf8mb4_0900_ai_ci", force: :cascade do |t|
    t.string "name"
    t.string "avatar_url"
    t.integer "validator_index"
    t.string "address"
    t.string "voting_power"
    t.string "successful_blocks"
    t.string "failed_blocks"
    t.string "balance"
    t.string "active_stake"
    t.string "consensus_public_key"
    t.string "fullnode_address"
    t.string "network_address"
    t.string "domain"
    t.string "ip_address"
    t.string "country"
    t.string "country_code"
    t.string "region"
    t.string "timezone"
    t.string "city"
    t.decimal "lat", precision: 10, scale: 6
    t.decimal "lng", precision: 10, scale: 6
    t.string "last_epoch_perf"
    t.float "rewards_growth"
    t.string "voting_record"
    t.string "rewards"
    t.string "start_date"
    t.float "performance"
    t.integer "blocks_purposed_day"
    t.integer "blocks_purposed_week"
    t.integer "blocks_purposed_month"
    t.float "data_center_score"
    t.float "voting_record_score"
    t.float "last_epoch_score"
    t.float "overall_score"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["address"], name: "index_validators_testnet_on_address"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "transactions_testnet", "blocks_testnet"
end
