FactoryBot.define do
  factory :epoch_history do
    batch_uuid { "MyString" }
    network { "MyString" }
    epoch { "MyString" }
    ledger_version { "MyString" }
    oldest_ledger_version { "MyString" }
    ledger_timestamp { "MyString" }
    node_role { "MyString" }
    oldest_block_height { "MyString" }
    block_height { "MyString" }
    git_hash { "MyString" }
  end
end
