module Services
end

require_relative 'services/analytics/normalizer'
require_relative 'services/analytics/calculators/distance_calculator'
require_relative 'services/analytics/calculators/performance_calculator'
require_relative 'services/analytics/calculators/rewards_calculator'
require_relative 'services/analytics/calculators/score_calculator'
require_relative 'services/analytics/calculators/voting_calculator'
require_relative 'services/analytics/metrics/validator_metrics'

# computes
require_relative 'services/analytics/compute/last_epoch_performance'
require_relative 'services/analytics/compute/rewards_growth'
require_relative 'services/analytics/compute/voting_record'
require_relative 'services/analytics/compute/total_rewards'