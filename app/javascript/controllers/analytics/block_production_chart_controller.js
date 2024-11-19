import {Controller} from "@hotwired/stimulus"
import {Chart, registerables} from "chart.js"
import BaseAnalyticsChartController from "./base_analytics_chart_controller"

Chart.register(...registerables)

export default class extends BaseAnalyticsChartController {
    static targets = ["chart", "timeRange"]
    static values = {
        address: String
    }

    connect() {
        this.loadChartData('week');
    }

    getChartColors() {
        const isDark = this.isDarkMode()
        return {
            daily: {
                borderColor: '#6366F1',
                backgroundColor: '#6366F1'
            },
            cumulative: {
                borderColor: '#8B5CF6',
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)'
            }
        }
    }

    async loadChartData(timeRange) {
        const response = await fetch(`/validators/${this.addressValue}/block_production?time_range=${timeRange}`);
        const data = await response.json();

        if (data.available_ranges) {
            this.updateRangeOptions(data.available_ranges, data.current_range);
        }

        if (this.chartInstances.has(this.chartTarget)) {
            this.chartInstances.get(this.chartTarget).destroy();
        }

        this.renderChart(data);
    }

    updateRangeOptions(ranges, currentRange) {
        const select = this.timeRangeTarget;
        console.log("select:", select);
        if (!ranges.length) {
            select.closest('div').classList.add('hidden');
            return;
        }

        select.closest('div').classList.remove('hidden');
        select.innerHTML = ranges.map(range =>
            `<option value="${range.value}" ${range.value === currentRange ? 'selected' : ''}>${range.label}</option>`
        ).join('');
    }

    updateTimeRange(event) {
        this.loadChartData(event.target.value);
    }

    renderChart(data) {
        if (!data?.block_production) return;

        const isDark = this.isDarkMode();
        const colors = this.getChartColors();

        const chart = new Chart(this.chartTarget, {
            data: {
                labels: data.block_production.map(r => new Date(r.datetime).toLocaleDateString()),
                datasets: [
                    {
                        type: 'bar',
                        label: 'Daily Blocks',
                        data: data.block_production.map(r => r.daily_blocks),
                        backgroundColor: colors.daily.backgroundColor,
                        borderRadius: 4,
                        yAxisID: 'y-daily',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: 'Cumulative Blocks',
                        data: data.block_production.map(r => r.cumulative_blocks),
                        borderColor: colors.cumulative.borderColor,
                        backgroundColor: colors.cumulative.backgroundColor,
                        fill: true,
                        tension: 0.4,
                        yAxisID: 'y-cumulative',
                        order: 1
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
                    'y-daily': {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Daily Blocks',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        ticks: {
                            callback: (value) => value.toFixed(0),
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        grid: {
                            drawBorder: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    'y-cumulative': {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Total Blocks',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        ticks: {
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                barPercentage: 0.7,
                categoryPercentage: 0.9
            }
        });

        this.chartInstances.set(this.chartTarget, chart);
    }
}