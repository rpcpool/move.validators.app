module ValidatorsHelper
  TIME_RANGES = [
    { days: 7, value: 'week', label: 'Last 7 Days' },
    { days: 14, value: '14days', label: 'Last 14 Days' },
    { days: 30, value: 'month', label: 'Last Month' },
    { days: 90, value: '3months', label: 'Last 3 Months' }
  ].freeze

  DAY_CHUNK_SIZE = 7.0.freeze

  def time_range(range_value)
    range = TIME_RANGES.find { |r| r[:value] == range_value }
    range&.fetch(:days)
  end

  def calculate_available_ranges(earliest_date)
    return [] unless earliest_date

    now = Time.current
    days_of_history = (now - earliest_date).to_i / 1.day
    ranges = []

    TIME_RANGES.each do |range|
      ranges << range.slice(:value, :label) if days_of_history >= range[:days]
    end

    ranges
  end

  def aggregate_rewards(rewards, range_value)
    days = time_range(range_value)
    return [] unless days

    end_date = Time.current.end_of_day
    start_date = (end_date - (days - 1).days).beginning_of_day

    # Generate all dates in range
    dates = (0..days - 1).map { |n| end_date - n.days }.reverse

    # Group rewards by date
    rewards_by_date = rewards
                        .where('reward_datetime >= ?', start_date)
                        .group_by { |r| r.reward_datetime.beginning_of_day }

    # Map dates to rewards, using 0 for dates with no rewards
    dates.map do |date|
      daily_rewards = rewards_by_date[date.beginning_of_day] || []
      total_amount = daily_rewards.sum { |r| r.amount.to_d }

      {
        datetime: date.iso8601,
        amount: total_amount.to_s,
        block_height: daily_rewards.last&.block_height || 0,
        version: daily_rewards.last&.version || 0
      }
    end
  end

end
