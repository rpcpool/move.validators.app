module AptosLogic
  include PipelineLogic

  # Create a batch record and set the :batch_uuid in the payload
  def batch_set
    lambda do |p|
      batch = Batch.create!(network: p.payload[:network])

      Pipeline.new(200, p.payload.merge(batch_uuid: batch.uuid))
    rescue ActiveRecord::ConnectionNotEstablished => e
      Appsignal.send_error(e)
      puts "#{e.class}\n#{e.message}"
      exit(500)
    rescue StandardError => e
      Pipeline.new(500, p.payload, 'Error from batch_set', e)
    end
  end

  def epoch_get
    lambda do |p|
      response = Faraday.get('https://api.mainnet.aptoslabs.com/v1')
      epoch_json = JSON(response.body)

      # {
      #   "chain_id": 1,
      #   "epoch": "6600",
      #   "ledger_version": "549666386",
      #   "oldest_ledger_version": "0",
      #   "ledger_timestamp": "1712954400660089",
      #   "node_role": "full_node",
      #   "oldest_block_height": "0",
      #   "block_height": "168339071",
      #   "git_hash": "4174fd615d442ccac6e5d77db00ba693d0d57108"
      # }

      epoch = EpochHistory.create(
        network: p.payload[:network],
        batch_uuid: p.payload[:batch_uuid],
        epoch: epoch_json['epoch'],
        ledger_version: epoch_json['ledger_version'],
        oldest_ledger_version: epoch_json['oldest_ledger_version'],
        ledger_timestamp: epoch_json['ledger_timestamp'],
        node_role: epoch_json['node_role'],
        oldest_block_height: epoch_json['oldest_block_height'],
        block_height: epoch_json['block_height'],
        git_hash: epoch_json['git_hash']
      )

      Pipeline.new(200, p.payload.merge(epoch: epoch.epoch))
    rescue ActiveRecord::ConnectionNotEstablished => e
      Appsignal.send_error(e)
      puts "#{e.class}\n#{e.message}"
      exit(500)
    rescue StandardError => e
      Pipeline.new(500, p.payload, 'Error from epoch_get', e)
    end

    Pipeline.new(200, p.payload.merge(batch_uuid: batch.uuid))
  end

  def validators_get
    lambda do |p|
      return p unless p[:code] == 200

      # validators_json = solana_client_request(
      #   p.payload[:config_urls],
      #   :get_cluster_nodes
      # )

      # validators = {}
      # validators_json.each do |hash|
      #   next if Rails.application.config.validator_blacklist[p.payload[:network]].include? hash["pubkey"]

      #   validators[hash['pubkey']] = {
      #     'gossip_ip_port' => hash['gossip'],
      #     'rpc_ip_port' => hash['rpc'],
      #     'tpu_ip_port' => hash['tpu'],
      #     'version' => hash['version']
      #   }
      # end

      url = 'https://api.mainnet.aptoslabs.com/v1/accounts/0x1/resource/0x1::stake::ValidatorSet'
      response = Faraday.get(url)
      parsed = JSON(response.body)

      active_validators = parsed['data']['active_validators']

      # array[] of objects{}:
      # {
      #   "addr": "0xdf0996b6998ec080ea7931ccd87400fa74eb57f8129bb0f11996ae8bae12d565",
      #   "config": {
      #     "consensus_pubkey": "0x871b93ccb298265e554b211f354e03b95a23165ca68d89cff849cd4b05e256a8611baaedc16a9b70f4f53c62bd1086ac",
      #     "fullnode_addresses": "0x014704021d6861736865642d76666e2e6170746f732e647372766c6162732e6e65740526180720d59f925295707a5ab0483b4831b816b7eb399f30f7dfb1d3a5bb54eac15698380800",
      #     "network_addresses": "0x014d0402236861736865642d76616c696461746f722e6170746f732e647372766c6162732e6e657405241807208bec6dab190d536b8b929bacba57f8b0188310f953a5e1b401ed537398b02b510800",
      #     "validator_index": "34"
      #   },
      #   "voting_power": "185798990168963"
      # }

      # also returns:
      # "consensus_scheme": 0,
      # "pending_active": [],
      # "pending_inactive": [],
      # "total_joining_power": "1034310000",
      # "total_voting_power": "86379474627565119"

      Pipeline.new(200, p.payload.merge(validators: active_validators))
    rescue StandardError => e
      Pipeline.new(500, p.payload, 'Error from validators_get', e)
    end
  end

  def validators_save
    lambda do |p|
      return p unless p[:code] == 200

      # p.payload[:validators_reduced].each do |k, v|
      p.payload[:validators].each do |v|
        validator = Validator.find_or_create_by(network: p.payload[:network], account: v)

        # Find or create the vote_account record
        # vote_account = validator.vote_accounts.find_or_create_by(
        #   account: v['vote_account']
        # )
        # validator.set_active_vote_account(vote_account)

        # Create Vote records to save a time series of vote & stake data
        # vote_account.vote_account_histories.create(
        #   network: p.payload[:network],
        #   batch_uuid: p.payload[:batch_uuid],
        #   commission: v['commission'],
        #   last_vote: v['last_vote'],
        #   credits: v['credits'],
        #   credits_current: v['credits_current'],
        #   slot_index_current: p.payload[:epoch_slot_index],
        #   activated_stake: v['activated_stake'],
        #   software_version: v['version']
        # )

        # Find or create the validator IP address
        # val_ip = validator.validator_ips.find_or_create_by(
        #   version: 4,
        #   address: v['gossip_ip_port'].split(':')[0]
        # )
        # val_ip.set_is_active
        # val_ip.touch


      end

      Pipeline.new(200, p.payload)
    rescue ActiveRecord::ConnectionNotEstablished => e
      Appsignal.send_error(e)
      puts "#{e.class}\n#{e.message}"
      exit(500)
    rescue StandardError => e
      Pipeline.new(500, p.payload, 'Error from validators_save', e)
    end
  end
end
