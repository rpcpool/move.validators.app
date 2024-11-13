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
        const selectElement = this.timeRangeTarget
        if (selectElement.options.length > 0) {
            selectElement.selectedIndex = 1
            this.loadChartData(selectElement.value)
        }
    }

    getChartColors() {
        const isDark = this.isDarkMode()
        return {
            rewards: {
                borderColor: '#667EEA', // indigo-500
                backgroundColor: isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)'
            }
        }
    }

    async loadChartData(timeRange) {
        const response = await fetch(`/validators/${this.addressValue}/rewards_history?time_range=${timeRange}`)
        const data = await response.json()

        if (this.chartInstances.has(this.chartTarget)) {
            this.chartInstances.get(this.chartTarget).destroy()
        }

        this.renderChart(data)
    }

    updateTimeRange(event) {
        this.loadChartData(event.target.value)
    }

    renderChart(data = null) {
        if (!data) return

        const isDark = this.isDarkMode()
        const colors = this.getChartColors()

        const chart = new Chart(this.chartTarget, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Rewards',
                    data: data.rewards,
                    borderColor: colors.rewards.borderColor,
                    backgroundColor: colors.rewards.backgroundColor,
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
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Rewards (APT)',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        ticks: {
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        grid: {
                            drawBorder: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        })

        this.chartInstances.set(this.chartTarget, chart)
    }
}