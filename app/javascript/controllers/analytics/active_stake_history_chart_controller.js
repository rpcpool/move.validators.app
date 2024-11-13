// app/javascript/controllers/analytics/stake_history_chart_controller.js
import BaseAnalyticsChartController from "./base_analytics_chart_controller"
import {Chart} from "chart.js"

export default class extends BaseAnalyticsChartController {
    static targets = ["chart"]

    getChartColors() {
        const isDark = this.isDarkMode()
        return {
            border: '#8B5CF6', // violet-500
            background: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)'
        }
    }

    renderChart() {
        const isDark = this.isDarkMode()
        const colors = this.getChartColors()

        const dataPoints = 4
        const labels = Array.from({length: dataPoints}, (_, i) => {
            const weeksAgo = dataPoints - 1 - i
            return weeksAgo === 0 ? 'This Week' : `${weeksAgo}w ago`
        })

        const chart = new Chart(this.chartTarget, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Active Stake (APT)',
                    data: this.generateRandomData(dataPoints, 24000000, 25000000),
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...this.getBaseChartOptions(isDark),
                plugins: {
                    ...this.getBaseChartOptions(isDark).plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${Number(context.parsed.y).toLocaleString()} APT`
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Active Stake (APT)',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        ticks: {
                            callback: (value) => {
                                return value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value
                            },
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        grid: {
                            drawBorder: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        })

        this.chartInstances.set(this.chartTarget, chart)
    }

    generateRandomData(points, min, max) {
        let lastValue = min + (max - min) / 2
        return Array.from({length: points}, () => {
            const maxChange = (max - min) * 0.05
            const change = (Math.random() * maxChange * 2) - maxChange
            lastValue = Math.max(min, Math.min(max, lastValue + change))
            return Number(lastValue.toFixed(0))
        })
    }
}