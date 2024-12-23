import {Controller} from "@hotwired/stimulus"
import {Chart, registerables} from "chart.js"
import BaseAnalyticsChartController from "./aa_base_analytics_chart_controller.js"

Chart.register(...registerables)

export default class extends BaseAnalyticsChartController {
    static targets = ["chart", "timeRange"]
    static values = {
        address: String
    }

    connect() {
        this.loadChartData('15epochs');
    }

    getChartColors() {
        const isDark = this.isDarkMode()
        return {
            balance: {
                borderColor: '#F59E0B',
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)'
            },
            rewards: {
                borderColor: '#8B5CF6',
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)'
            }
        }
    }

    async loadChartData(timeRange) {
        const response = await fetch(`/validators/${this.addressValue}/balance_vs_rewards?time_range=${timeRange}`);
        const data = await response.json();

        if (data?.available_ranges?.length > 0) {
            this.updateRangeOptions(data.available_ranges, data.current_range);
        } else {
            // Set default range option if no ranges available
            this.updateRangeOptions([{ value: '15epochs', label: 'Last 15 Epochs' }], '15epochs');
        }

        if (this.chartInstances.has(this.chartTarget)) {
            this.chartInstances.get(this.chartTarget).destroy();
        }

        this.renderChart(data);
    }

    updateRangeOptions(ranges, currentRange) {
        const select = this.timeRangeTarget;
        select.innerHTML = ranges.map(range =>
            `<option value="${range.value}" ${range.value === currentRange ? 'selected' : ''}>${range.label}</option>`
        ).join('');
    }

    updateTimeRange(event) {
        this.loadChartData(event.target.value);
    }

    renderChart(data) {
        if (!data?.balance_rewards) return;

        const isDark = this.isDarkMode();
        const colors = this.getChartColors();

        const chart = new Chart(this.chartTarget, {
            type: 'line',
            data: {
                labels: data.balance_rewards.map(r => new Date(r.datetime).toLocaleDateString()),
                datasets: [
                    {
                        label: 'Balance',
                        data: data.balance_rewards.map(r => parseFloat(r.balance)),
                        borderColor: colors.balance.borderColor,
                        backgroundColor: colors.balance.backgroundColor,
                        borderWidth: 2,
                        yAxisID: 'y-balance',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Cumulative Rewards',
                        data: data.balance_rewards.map(r => parseFloat(r.cumulative_rewards)),
                        borderColor: colors.rewards.borderColor,
                        backgroundColor: colors.rewards.backgroundColor,
                        borderWidth: 2,
                        yAxisID: 'y-rewards',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                ...this.getBaseChartOptions(isDark),
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        }
                    },
                    'y-balance': {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Balance (APT)',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        ticks: {
                            callback: (value) => {
                                if (value >= 1000) {
                                    return `${(value / 1000).toFixed(1)}k`;
                                }
                                return value.toFixed(1);
                            },
                            color: isDark ? '#9CA3AF' : '#6B7280',
                            maxTicksLimit: 6
                        },
                        min: 0,
                        grid: {
                            drawBorder: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    'y-rewards': {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Rewards (APT)',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        ticks: {
                            callback: (value) => {
                                if (value >= 1000) {
                                    return `${(value / 1000).toFixed(1)}k`;
                                }
                                return value.toFixed(1);
                            },
                            color: isDark ? '#9CA3AF' : '#6B7280',
                            maxTicksLimit: 6
                        },
                        min: 0,
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });

        this.chartInstances.set(this.chartTarget, chart);
    }
}
