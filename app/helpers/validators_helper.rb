module ValidatorsHelper
  # Assuming each epoch is roughly 1 day
  TIME_RANGES = [
    { epochs: 1, value: 'day', label: 'Last Epoch' },
    { epochs: 7, value: 'week', label: 'Last 7 Epochs' },
    { epochs: 15, value: '15epochs', label: 'Last 15 Epochs' },
    { epochs: 30, value: 'month', label: 'Last 30 Epochs' }
  ].freeze

  EPOCH_CHUNK_SIZE = 7.0.freeze

  def current_epoch
    ValidatorReward.maximum(:sequence) || 0
  end

  def epoch_to_datetime(sequence)
    return Time.current unless sequence

    # Try to find a record with this sequence number
    record = ValidatorReward.where(sequence: sequence.to_i).order(created_at: :desc).first ||
             Block.where(sequence: sequence.to_i).order(created_at: :desc).first
    
    record&.created_at || Time.current
  end

  def octas_to_apt(octas, precision = 8)
    return 0.0 if octas.nil? || (octas.is_a?(String) && octas.blank?)
    
    # Convert to decimal if it's a string, otherwise use as is
    value = octas.is_a?(String) ? octas.to_d : octas
    
    # Convert octas to APT (8 decimal places)
    (value / 100_000_000.0).round(precision)
  end

  def time_range(range_value)
    range = TIME_RANGES.find { |r| r[:value] == range_value }
    range&.fetch(:epochs)
  end

  def calculate_available_ranges(earliest_sequence)
    return [] unless earliest_sequence

    # Convert to integer if it's not already
    earliest_sequence = earliest_sequence.to_i if earliest_sequence.respond_to?(:to_i)
    latest_sequence = current_epoch
    sequences_of_history = latest_sequence - earliest_sequence
    ranges = []

    TIME_RANGES.each do |range|
      ranges << range.slice(:value, :label) if sequences_of_history >= range[:epochs]
    end

    ranges
  end

  def aggregate_rewards(rewards, range_value)
    num_epochs = time_range(range_value)
    return [] unless num_epochs

    latest_sequence = rewards.maximum(:sequence) || 0
    start_sequence = latest_sequence - (num_epochs - 1)

    # Generate all sequences in range
    sequences = (start_sequence..latest_sequence).to_a

    # Group rewards by sequence
    rewards_by_sequence = rewards
                          .where(sequence: start_sequence..latest_sequence)
                          .group_by(&:sequence)

    # Map sequences to rewards, using 0 for sequences with no rewards
    sequences.map do |seq|
      sequence_rewards = rewards_by_sequence[seq] || []
      total_amount = sequence_rewards.sum { |r| r.amount.to_d }
      latest_reward = sequence_rewards.max_by(&:created_at)

      {
        datetime: latest_reward&.created_at&.iso8601 || Time.current.iso8601,
        amount: total_amount.to_s,
        block_height: latest_reward&.block_height.to_i,
        version: latest_reward&.version.to_i,
        epoch: seq
      }
    end
  end
end
