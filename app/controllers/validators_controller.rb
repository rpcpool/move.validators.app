class ValidatorsController < ApplicationController
  include ValidatorsHelper
  before_action :set_validator, only: [:show, :analytics, :rewards_history, :rewards_growth, :balance_vs_rewards, :performance_metrics, :block_production, :active_stake_history]

  def index
    # Determine the column and direction for sorting
    sort_column = params[:sort] || 'overall_score'
    sort_direction = params[:direction] || 'desc'

    # Order validators dynamically and paginate
    @validators = Validator.order("#{sort_column} #{sort_direction}").page(params[:page])

    # Fetch the latest epoch stats and count the active validators
    epoch_history = EpochHistory.order(epoch: :desc).limit(1).first
    count = Validator.count
    average_stake = Validator.average("CAST(active_stake AS DECIMAL(65,0))")
    total_stake = Validator.sum("CAST(active_stake AS DECIMAL(65,0))")
    @stats = {
      epoch: epoch_history.epoch,
      active_validators: count,
      average_stake: average_stake,
      total_stake: total_stake
    }

  end

  # Controller action
  def show
    @rewards = ValidatorReward
                 .where(validator_address: @validator.address)
                 .recent
                 .page(params[:page])
                 .per(25)

    @total_rewards = ValidatorReward
                       .where(validator_address: @validator.address)
                       .sum { |reward| reward.amount.to_d }
                       .to_d / 100_000_000.0
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
                       .recent # This uses the scope we defined: order(reward_datetime: :desc)
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
    earliest_reward = @validator.validator_rewards.minimum(:reward_datetime)
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
    earliest_reward = rewards.order(reward_datetime: :asc).first
    earliest_date = earliest_reward&.reward_datetime
    available_ranges = calculate_available_ranges(earliest_date)

    rewards_data = aggregate_rewards(rewards, params[:time_range] || 'default')

    render json: {
      rewards: rewards_data,
      available_ranges: available_ranges,
      current_range: params[:time_range] || 'default'
    }
  end

  # With rewards growth, we need to have a handle on all the rewards in our system from the beginning per
  # validator address. Then we offer up slices for the time range.
  def rewards_growth
    rewards = @validator.validator_rewards
    earliest_reward = rewards.order(reward_datetime: :asc).first
    earliest_date = earliest_reward&.reward_datetime
    available_ranges = calculate_available_ranges(earliest_date)

    # Get all daily totals with proper group by
    daily_totals = rewards
                     .select(
                       "DATE(reward_datetime) as date",
                       "SUM(CAST(amount AS DECIMAL)) as daily_amount"
                     )
                     .group("DATE(reward_datetime)")
                     .order("DATE(reward_datetime)")

    # Calculate cumulative totals
    running_total = 0
    all_growth_data = daily_totals.map do |day|
      running_total += day.daily_amount
      {
        datetime: day.date.to_datetime.iso8601,
        amount: day.daily_amount.to_s,
        cumulative_amount: running_total.to_s
      }
    end

    # Slice the window based on time range
    days = time_range(params[:time_range] || 'default')
    start_date = (Time.current - (days - 1).days).beginning_of_day if days

    growth_data = days ? all_growth_data.select { |d| Time.parse(d[:datetime]) >= start_date } : all_growth_data

    render json: {
      rewards_growth: growth_data,
      available_ranges: available_ranges,
      current_range: params[:time_range] || 'default'
    }
  end

  def balance_vs_rewards
    rewards = @validator.validator_rewards
    earliest_reward = rewards.order(reward_datetime: :asc).first
    earliest_date = earliest_reward&.reward_datetime
    available_ranges = calculate_available_ranges(earliest_date)

    # Get daily rewards totals
    daily_totals = rewards
                     .select(
                       "DATE(reward_datetime) as date",
                       "SUM(CAST(amount AS DECIMAL)) as daily_amount"
                     )
                     .group("DATE(reward_datetime)")
                     .order("DATE(reward_datetime)")

    # Calculate cumulative rewards
    running_total = 0
    all_data = daily_totals.map do |day|
      running_total += day.daily_amount
      {
        datetime: day.date.to_datetime.iso8601,
        rewards: day.daily_amount.to_s,
        cumulative_rewards: running_total.to_s,
        balance: day.daily_amount.to_s # Need to integrate with balance data
      }
    end

    days = time_range(params[:time_range] || 'default')
    start_date = (Time.current - (days - 1).days).beginning_of_day if days

    chart_data = days ? all_data.select { |d| Time.parse(d[:datetime]) >= start_date } : all_data

    render json: {
      balance_rewards: chart_data,
      available_ranges: available_ranges,
      current_range: params[:time_range] || 'default'
    }
  end

  # def block_production
  #   blocks_by_epoch = Block.where(validator_address: @validator.address)
  #                          .where.not(epoch: nil)
  #                          .group(:epoch)
  #                          .order(epoch: :desc)
  #                          .limit(10) # Get last 10 epochs
  #                          .count
  #
  #   data = blocks_by_epoch.map do |epoch, block_count|
  #     {
  #       epoch: epoch,
  #       block_count: block_count
  #     }
  #   end
  #
  #   respond_to do |format|
  #     format.json { render json: data }
  #   rescue StandardError => e
  #     Rails.logger.error "Block Production Error: #{e.class} - #{e.message}"
  #     Rails.logger.error e.backtrace.join("\n")
  #     render json: {
  #       error: 'Error fetching block production data',
  #       details: e.message,
  #       backtrace: e.backtrace
  #     }, status: :internal_server_error
  #   end
  # end

  def block_production
    blocks = Block.where(validator_address: @validator.address)
    earliest_block = blocks.order(block_timestamp: :asc).first
    earliest_date = earliest_block&.block_timestamp
    puts ">>> earliest date: #{earliest_date.inspect}"
    available_ranges = calculate_available_ranges(earliest_date)
    puts ">>> available_ranges: #{available_ranges.inspect}"

    # Get daily block counts
    daily_blocks = blocks
                     .select("DATE(block_timestamp) as date", "COUNT(*) as block_count")
                     .group("DATE(block_timestamp)")
                     .order("DATE(block_timestamp)")

    # Calculate running totals
    running_total = 0
    all_data = daily_blocks.map do |day|
      running_total += day.block_count
      {
        datetime: day.date.to_datetime.iso8601,
        daily_blocks: day.block_count,
        cumulative_blocks: running_total
      }
    end

    # Filter by time range
    days = time_range(params[:time_range] || 'default')
    start_date = (Time.current - (days - 1).days).beginning_of_day if days

    chart_data = days ? all_data.select { |d| Time.parse(d[:datetime]) >= start_date } : all_data

    render json: {
      block_production: chart_data,
      available_ranges: available_ranges,
      current_range: params[:time_range] || 'default'
    }
  end

  # Below actions might be deprecated

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
    epoch_range = (params[:epoch_range] || 5).to_i

    epochs = StakeHistory.where(pool_address: @validator.address)
                         .where.not(epoch: nil)
                         .distinct
                         .order(epoch: :desc)
                         .limit(epoch_range)
                         .pluck(:epoch)
                         .sort

    data = epochs.map do |epoch|
      stakes = StakeHistory.where(pool_address: @validator.address, epoch: epoch)

      current_stake = stakes.order(version: :desc).first&.active_stake

      withdrawn = stakes.where(event_type: '0x1::stake::WithdrawStakeEvent')
                        .sum { |s| JSON.parse(s.raw_data)['data']['amount_withdrawn'].to_i }
      added = stakes.where(event_type: '0x1::stake::AddStakeEvent')
                    .sum { |s| JSON.parse(s.raw_data)['data']['amount_added'].to_i }

      {
        epoch: epoch,
        current_stake: current_stake.to_i,
        withdrawn: withdrawn,
        added: added
      }
    end

    render json: {
      data: data,
      epoch_range: epoch_range
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
    base_query = @validator.validator_rewards.order(sequence: :desc)

    case time_range
    when 'week'
      base_query.where('reward_datetime >= ?', 1.week.ago)
    when '14days'
      base_query.where('reward_datetime >= ?', 14.days.ago)
    when 'month'
      base_query.where('reward_datetime >= ?', 1.month.ago)
    when '3months'
      base_query.where('reward_datetime >= ?', 3.months.ago)
    else
      base_query.limit(100) # Your default case
    end
  end
end
