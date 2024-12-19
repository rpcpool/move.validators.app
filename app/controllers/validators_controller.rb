class ValidatorsController < ApplicationController
  include ValidatorsHelper
  before_action :set_validator, only: [:show, :analytics, :rewards_history, :rewards_growth, :balance_vs_rewards, :performance_metrics, :block_production, :active_stake_history]

  def index
    # Determine the column and direction for sorting
    sort_column = params[:sort] || 'overall_score'
    sort_direction = params[:direction] || 'desc'

    # Order validators dynamically and paginate
    @validators = Validator.order("#{sort_column} #{sort_direction}").page(params[:page])

    # Fetch validator stats
    count = Validator.count
    average_stake = Validator.average("CAST(active_stake AS DECIMAL(65,0))")
    total_stake = Validator.sum("CAST(active_stake AS DECIMAL(65,0))")
    latest_sequence = ValidatorReward.maximum(:sequence) || 0
    @stats = {
      epoch: latest_sequence,
      active_validators: count,
      average_stake: average_stake,
      total_stake: total_stake
    }
  end

  def show
    @rewards = ValidatorReward
                 .where(validator_address: @validator.address)
                 .recent
                 .page(params[:page])
                 .per(25)

    # Use the validator's rewards column which is kept up to date by ValidatorRewardsJob
    @total_rewards = @validator.rewards.present? ? (@validator.rewards.to_i / 100_000_000.0) : 0
  rescue => e
    Rails.logger.error "Error fetching rewards for validator #{@validator.address}: #{e.message}"
    # Instead of setting to empty array, use empty scope
    @rewards = ValidatorReward.none.page(params[:page])
    @total_rewards = 0
    flash.now[:alert] = "Failed to fetch rewards data"
  end

  def rewards
    validator_address = params.require(:id)

    begin
      rewards_list = ValidatorReward
                       .where(validator_address: validator_address)
                       .order(sequence: :desc) # Use sequence instead of reward_datetime
                       .limit(20)
                       .includes(:validator) # If you need validator info in the view

      if rewards_list.any?
        render partial: 'rewards', locals: { rewards: rewards_list }
      else
        render partial: 'error', locals: { message: 'No rewards data found' }
      end
    rescue ActiveRecord::RecordNotFound => e
      render partial: 'error', locals: { message: 'Validator not found' }
    rescue => e
      Rails.logger.error "Error fetching rewards for validator #{validator_address}: #{e.message}"
      render partial: 'error', locals: { message: 'Failed to fetch rewards data' }
    end
  end

  def analytics
    metrics = Services::Analytics::Metrics::ValidatorMetrics.new(@validator)

    @rewards_history = @validator.validator_rewards.order(sequence: :desc).limit(100)
    earliest_reward = @validator.validator_rewards.minimum(:sequence)
    # @available_time_ranges = calculate_available_ranges(earliest_reward)

    @performance_data = {
      overall_score: metrics.overall_score,
      voting_record_score: metrics.voting_record_score,
      last_epoch_score: metrics.last_epoch_score,
      performance: metrics.performance_score,
      data_center_score: metrics.data_center_score
    }

    @blocks_data = {
      daily: @validator.blocks_purposed_day,
      weekly: @validator.blocks_purposed_week,
      monthly: @validator.blocks_purposed_month
    }

    respond_to do |format|
      format.html
    end
  end

  def rewards_history
    rewards = @validator.validator_rewards
    # Get the sequence range for this validator
    latest_sequence = (rewards.maximum(:sequence) || 0).to_i
    num_epochs = time_range(params[:time_range] || '15epochs')
    start_sequence = latest_sequence - (num_epochs - 1) if num_epochs && latest_sequence

    # Always include at least one epoch range
    available_ranges = if rewards.empty?
      [{ value: 'day', label: 'Last Epoch' }]
    else
      earliest_reward = rewards.order(sequence: :asc).first
      ranges = calculate_available_ranges(earliest_reward&.sequence)
      ranges.empty? ? [{ value: 'day', label: 'Last Epoch' }] : ranges
    end

    # Generate all sequences in range
    sequences = (start_sequence..latest_sequence).to_a

    # Get rewards directly from validator_rewards
    rewards_by_sequence = if rewards.empty?
      {}
    else
      rewards
        .where(sequence: start_sequence..latest_sequence)
        .group(:sequence)
        .sum("CAST(amount AS DECIMAL) / 100000000.0")
    end

    # Map sequences to rewards, using 0 for sequences with no rewards
    rewards_data = if sequences.empty?
      [{
        datetime: Time.current.iso8601,
        amount: "0",
        epoch: latest_sequence
      }]
    else
      sequences.map do |seq|
        reward = rewards.where(sequence: seq).order(created_at: :desc).first
        {
          datetime: reward&.created_at&.iso8601 || Time.current.iso8601,
          amount: rewards_by_sequence[seq].to_f.round(8).to_s,
          epoch: seq
        }
      end
    end

    render json: {
      rewards: rewards_data,
      available_ranges: available_ranges,
      current_range: params[:time_range] || '15epochs'
    }
  end

  def rewards_growth
    rewards = @validator.validator_rewards
    # Get the sequence range for this validator
    latest_sequence = (rewards.maximum(:sequence) || 0).to_i
    num_epochs = time_range(params[:time_range] || '15epochs')
    start_sequence = latest_sequence - (num_epochs - 1) if num_epochs && latest_sequence

    # Always include at least one epoch range
    available_ranges = if rewards.empty?
      [{ value: 'day', label: 'Last Epoch' }]
    else
      earliest_reward = rewards.order(sequence: :asc).first
      ranges = calculate_available_ranges(earliest_reward&.sequence)
      ranges.empty? ? [{ value: 'day', label: 'Last Epoch' }] : ranges
    end

    # Generate all sequences in range
    sequences = (start_sequence..latest_sequence).to_a

    # Get rewards directly from validator_rewards
    rewards_by_sequence = if rewards.empty?
      {}
    else
      rewards
        .where(sequence: start_sequence..latest_sequence)
        .group(:sequence)
        .sum("CAST(amount AS DECIMAL) / 100000000.0")
    end

    # Map sequences to rewards and calculate cumulative totals
    running_total = 0
    growth_data = if sequences.empty?
      [{
        datetime: Time.current.iso8601,
        amount: "0",
        cumulative_amount: "0",
        epoch: latest_sequence
      }]
    else
      sequences.map do |seq|
        reward = rewards.where(sequence: seq).order(created_at: :desc).first
        amount = rewards_by_sequence[seq].to_f.round(8)
        running_total += amount
        {
          datetime: reward&.created_at&.iso8601 || Time.current.iso8601,
          amount: amount.to_s,
          cumulative_amount: running_total.round(8).to_s,
          epoch: seq
        }
      end
    end

    render json: {
      rewards_growth: growth_data,
      available_ranges: available_ranges,
      current_range: params[:time_range] || '15epochs'
    }
  end

  def balance_vs_rewards
    rewards = @validator.validator_rewards
    balances = @validator.validator_balances
    
    # Get the sequence range for this validator
    latest_sequence = (rewards.maximum(:sequence) || 0).to_i
    earliest_reward = rewards.order(sequence: :asc).first
    
    # Always include at least one epoch range
    available_ranges = if rewards.empty?
      [{ value: 'day', label: 'Last Epoch' }]
    else
      ranges = calculate_available_ranges(earliest_reward&.sequence)
      ranges.empty? ? [{ value: 'day', label: 'Last Epoch' }] : ranges
    end

    num_epochs = time_range(params[:time_range] || '15epochs')
    start_sequence = latest_sequence - (num_epochs - 1) if num_epochs && latest_sequence

    # Handle empty data cases
    if rewards.empty? && balances.empty?
      # No rewards or balances
      all_data = [{
        datetime: Time.current.iso8601,
        rewards: "0",
        cumulative_rewards: "0",
        balance: "0",
        epoch: latest_sequence
      }]
    elsif rewards.empty?
      # Only balances, no rewards
      # Get the most recent balance
      balance = balances.order(version: :desc).first
      balance_in_apt = balance&.total_balance.present? ? (balance.total_balance.to_i / 100_000_000.0).round(2) : 0

      # Create data points for each epoch with the same balance
      all_data = (start_sequence..latest_sequence).map do |epoch|
          {
            datetime: balance.created_at.iso8601,
            rewards: "0",
            cumulative_rewards: "0",
            balance: balance_in_apt.to_s,
            epoch: epoch
          }
        end
    else
      # Get rewards and balances by sequence
      epoch_data = rewards
                    .where(sequence: start_sequence..latest_sequence)
                    .group(:sequence)
                    .select(
                      'sequence as epoch',
                      'SUM(CAST(amount AS DECIMAL) / 100000000.0) as epoch_amount'
                    )
                    .order(:sequence)
                    .map do |epoch_reward|
          # Find the balance for this sequence
          # Get the most recent balance record we have
          balance = balances.order(version: :desc).first

          balance_in_apt = if balance&.total_balance.present?
            (balance.total_balance.to_i / 100_000_000.0).round(2)
          else
            0
          end
          
          {
            epoch: epoch_reward.epoch,
            epoch_amount: (epoch_reward.epoch_amount || 0).round(2),
            balance: balance_in_apt.to_s
          }
        end

      # Calculate cumulative rewards
      running_total = 0
      all_data = epoch_data.map do |data|
        running_total += (data[:epoch_amount] || 0)
        {
          datetime: rewards.where(sequence: data[:epoch]).order(created_at: :desc).first&.created_at&.iso8601 || Time.current.iso8601,
          rewards: data[:epoch_amount].to_s,
          cumulative_rewards: running_total.round(2).to_s,
          balance: data[:balance],
          epoch: data[:epoch]
        }
      end
    end

    # Filter by epoch range if needed
    chart_data = start_sequence ? all_data.select { |d| d[:epoch] >= start_sequence } : all_data

    render json: {
      balance_rewards: chart_data,
      available_ranges: available_ranges,
      current_range: params[:time_range] || '15epochs'
    }
  rescue => e
    Rails.logger.error "Balance vs Rewards Error: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    render json: { error: 'Error fetching balance and rewards data' }, status: :internal_server_error
  end

  def block_production
    blocks = Block.where(validator_address: @validator.address)
    # Get the sequence range for this validator
    latest_epoch = (blocks.maximum(:epoch) || 0).to_i
    earliest_block = blocks.order(epoch: :asc).first

    # Always include at least one epoch range
    available_ranges = if blocks.empty?
      [{ value: 'day', label: 'Last Epoch' }]
    else
      ranges = calculate_available_ranges(earliest_block&.epoch)
      ranges.empty? ? [{ value: 'day', label: 'Last Epoch' }] : ranges
    end

    num_epochs = time_range(params[:time_range] || '15epochs')
    start_epoch = latest_epoch - (num_epochs - 1) if num_epochs && latest_epoch

    # Get blocks by epoch
    epoch_blocks = blocks
                    .where(epoch: (start_epoch.to_i..latest_epoch.to_i).map(&:to_s))
                    .group(:epoch)
                    .select(
                      'epoch',
                      'COUNT(*) as block_count'
                    )
                    .order(Arel.sql('CAST(epoch AS UNSIGNED)'))

    # Calculate running totals
    running_total = 0
    all_data = epoch_blocks.map do |epoch_data|
      block = blocks.where(epoch: epoch_data.epoch).order(created_at: :desc).first
      running_total += epoch_data.block_count
      {
        datetime: block&.created_at&.iso8601 || Time.current.iso8601,
        epoch_blocks: epoch_data.block_count,
        cumulative_blocks: running_total,
        epoch: epoch_data.epoch
      }
    end

    # Filter by epoch range if needed
    chart_data = start_epoch ? all_data.select { |d| d[:epoch].to_i >= start_epoch.to_i } : all_data

    render json: {
      block_production: chart_data,
      available_ranges: available_ranges,
      current_range: params[:time_range] || '15epochs'
    }
  end

  def performance_metrics
    metrics = Services::Analytics::Metrics::ValidatorMetrics.new(@validator)

    if metrics.weekly_performance_metrics.present?
      render json: metrics.weekly_performance_metrics
    else
      render json: { error: 'Unable to calculate performance metrics' }, status: :unprocessable_entity
    end
  rescue StandardError => e
    Rails.logger.error "Performance Metrics Error: #{e.class} - #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    render json: {
      error: 'Error calculating performance metrics',
      details: e.message,
      backtrace: e.backtrace
    }, status: :internal_server_error
  end

  def active_stake_history
    sequence_range = (params[:epoch_range] || 5).to_i

    # Get the latest sequence range
    latest_sequence = ValidatorReward.maximum(:sequence) || 0
    start_sequence = latest_sequence - (sequence_range - 1)

    sequences = StakeHistory.where(pool_address: @validator.address)
                         .where.not(epoch: nil)
                         .where(epoch: (start_sequence..latest_sequence).map(&:to_s))
                         .distinct
                         .pluck(:epoch)
                         .map(&:to_i)
                         .sort

    data = sequences.map do |seq|
      stakes = StakeHistory.where(pool_address: @validator.address, epoch: seq.to_s)

      current_stake = stakes.order(version: :desc).first&.active_stake

      withdrawn = stakes.where(event_type: '0x1::stake::WithdrawStakeEvent')
                        .sum { |s| JSON.parse(s.raw_data)['data']['amount_withdrawn'].to_i }
      added = stakes.where(event_type: '0x1::stake::AddStakeEvent')
                    .sum { |s| JSON.parse(s.raw_data)['data']['amount_added'].to_i }

      {
        epoch: seq,
        current_stake: current_stake.to_i,
        withdrawn: withdrawn,
        added: added
      }
    end

    render json: {
      data: data,
      epoch_range: sequence_range
    }
  end

  private

  def set_validator
    @validator = Validator.find_by!(address: params[:id])
  end

  def validator_params
    params.require(:validator).permit(:name, :network, :avatar, :avatar_url, :validator_index, :address, :voting_power, :consensus_public_key, :fullnode_address, :network_address, :domain)
  end

  def sortable_columns
    %w[overall_score name validator_index performance voting_power]
  end

  def sort_column
    sortable_columns.include?(params[:sort]) ? params[:sort] : 'overall_score'
  end

  def sort_direction
    %w[asc desc].include?(params[:direction]) ? params[:direction] : 'desc'
  end

    def fetch_rewards_history(time_range = nil)
    rewards = @validator.validator_rewards
    base_query = rewards.order(sequence: :desc)

    latest_sequence = (rewards.maximum(:sequence) || 0).to_i
    num_epochs = time_range(time_range || '15epochs')
    start_sequence = latest_sequence - (num_epochs - 1) if num_epochs && latest_sequence

    if start_sequence
      base_query.where(sequence: start_sequence..latest_sequence)
    else
      base_query.limit(100) # Your default case
    end
  end
end
