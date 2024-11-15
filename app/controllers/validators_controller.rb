class ValidatorsController < ApplicationController
  before_action :set_validator, only: [:show, :analytics, :rewards_history, :performance_metrics, :block_production, :active_stake_history]

  def index
    # Determine the column and direction for sorting
    sort_column = params[:sort] || 'overall_score'
    sort_direction = params[:direction] || 'desc'

    # Order validators dynamically and paginate
    @validators = Validator.order("#{sort_column} #{sort_direction}").page(params[:page])

    # Fetch the latest epoch stats and count the active validators
    @stats = Epoch.order(epoch: :desc).limit(1).first
    @stats.active_validators = Validator.count
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
    epoch_range = (params[:epoch_range] || 5).to_i

    recent_blocks = Block.where(validator_address: @validator.address)
                         .where.not(epoch: nil)
                         .select('DISTINCT epoch, first_version, last_version')
                         .order(:epoch)
                         .limit(epoch_range)

    puts recent_blocks.inspect

    version_ranges = recent_blocks.map { |b| (b.first_version..b.last_version).to_a }.flatten.uniq

    puts version_ranges.inspect

    rewards = @validator.validator_rewards
                        .where(version: version_ranges)
                        .order(sequence: :desc)

    respond_to do |format|
      format.json {
        render json: {
          rewards: rewards.pluck(:amount).map { |amt| amt.to_f / 100_000_000 },
          epochs: recent_blocks.pluck(:epoch),
          epoch_range: epoch_range
        }
      }
    end
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

  def block_production
    blocks_by_epoch = Block.where(validator_address: @validator.address)
                           .where.not(epoch: nil)
                           .group(:epoch)
                           .order(epoch: :desc)
                           .limit(10) # Get last 10 epochs
                           .count

    data = blocks_by_epoch.map do |epoch, block_count|
      {
        epoch: epoch,
        block_count: block_count
      }
    end

    respond_to do |format|
      format.json { render json: data }
    rescue StandardError => e
      Rails.logger.error "Block Production Error: #{e.class} - #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      render json: {
        error: 'Error fetching block production data',
        details: e.message,
        backtrace: e.backtrace
      }, status: :internal_server_error
    end
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

  # for rewards history
  def calculate_available_ranges(earliest_date)
    return [] unless earliest_date

    now = Time.current
    days_of_history = (now - earliest_date).to_i / 1.day

    puts "Earliest date: #{earliest_date}"
    puts "Days of history: #{days_of_history}"

    ranges = []
    ranges << { value: 'default', label: 'All Time' }

    # Define our standard time ranges in days
    time_ranges = [
      { days: 7, value: 'week', label: 'Last 7 Days' },
      { days: 14, value: '14days', label: 'Last 14 Days' },
      { days: 30, value: 'month', label: 'Last Month' },
      { days: 90, value: '3months', label: 'Last 3 Months' }
    ]

    # Only add ranges that we have enough data for
    time_ranges.each do |range|
      if days_of_history >= range[:days]
        ranges << { value: range[:value], label: range[:label] }
      end
    end

    puts "Final ranges: #{ranges.inspect}"
    ranges
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
