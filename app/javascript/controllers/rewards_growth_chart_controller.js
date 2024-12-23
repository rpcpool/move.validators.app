import {Controller} from "@hotwired/stimulus"
import {Chart, registerables} from "chart.js"
import BaseAnalyticsChartController from "controllers/base_analytics_chart_controller"

Chart.register(...registerables)

export default class extends BaseAnalyticsChartController {
    static targets = ["chart", "timeRange"];
    static values = {
        address: String
    }

    connect() {
        this.loadChartData('15epochs');
    }

    getChartColors() {
        const isDark = this.isDarkMode()
        return {
            growth: {
                borderColor: '#10B981',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'
            }
        }
    }

    async loadChartData(timeRange) {
        const response = await fetch(`/validators/${this.addressValue}/rewards_growth?time_range=${timeRange}`);
        const data = await response.json();

        if (data.available_ranges.length > 0) {
            this.updateRangeOptions(data.available_ranges, data.current_range);
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

    convertOctasToApt(octas) {
        return parseFloat(octas) / 100000000;
    }

    renderChart(data) {
        if (!data?.rewards_growth) return;

        const isDark = this.isDarkMode();
        const colors = this.getChartColors();

        const chart = new Chart(this.chartTarget, {
            type: 'line',
            data: {
                labels: data.rewards_growth.map(r => new Date(r.datetime).toLocaleDateString()),
                datasets: [{
                    label: 'Cumulative Rewards',
                    data: data.rewards_growth.map(r => this.convertOctasToApt(r.cumulative_amount)),
                    borderColor: colors.growth.borderColor,
                    backgroundColor: colors.growth.backgroundColor,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
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
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Total Rewards (APT)',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        ticks: {
                            callback: (value) => value.toFixed(4),
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        grid: {
                            drawBorder: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });

        this.chartInstances.set(this.chartTarget, chart);
    }
}
