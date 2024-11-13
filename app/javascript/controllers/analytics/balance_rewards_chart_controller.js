// app/javascript/controllers/balance_rewards_chart_controller.js
import {Controller} from "@hotwired/stimulus"
import {Chart, registerables} from "chart.js"
import BaseAnalyticsChartController from "./base_analytics_chart_controller";

Chart.register(...registerables)

export default class extends BaseAnalyticsChartController {
    static targets = ["chart"]

    getChartColors() {
        const isDark = this.isDarkMode()
        return {
            balance: {
                borderColor: '#F59E0B', // amber-500
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)'
            },
            rewards: {
                borderColor: '#8B5CF6', // violet-500
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)'
            }
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

        const balanceData = this.generateBalanceData(dataPoints, 999900, 1000100)
        const rewardsData = this.generateCumulativeRewards(dataPoints, 4700, 4811)

        const chart = new Chart(this.chartTarget, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Balance',
                        data: balanceData,
                        borderColor: colors.balance.borderColor,
                        backgroundColor: colors.balance.backgroundColor,
                        borderWidth: 2,
                        yAxisID: 'y-balance',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Cumulative Rewards',
                        data: rewardsData,
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
                            callback: (value) => `${(value / 1000).toFixed(1)}k`,
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
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
                            callback: (value) => `${(value).toFixed(0)}`,
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
                }
            }
        })

        this.chartInstances.set(this.chartTarget, chart)
    }

    generateBalanceData(points, min, max) {
        let lastValue = min + (max - min) / 2
        return Array.from({length: points}, () => {
            const maxChange = (max - min) * 0.02
            const change = (Math.random() * maxChange * 2) - maxChange
            lastValue = Math.max(min, Math.min(max, lastValue + change))
            return Number(lastValue.toFixed(0))
        })
    }

    generateCumulativeRewards(points, min, max) {
        const step = (max - min) / (points - 1)
        return Array.from({length: points}, (_, i) =>
            Number((min + (step * i)).toFixed(2))
        )
    }
}