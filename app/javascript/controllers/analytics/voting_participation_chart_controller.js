// app/javascript/controllers/analytics/voting_participation_chart_controller.js
import BaseAnalyticsChartController from "./base_analytics_chart_controller"
import {Chart} from "chart.js"

export default class extends BaseAnalyticsChartController {
    static targets = ["chart"]

    getChartColors() {
        return {
            participated: '#22C55E', // green-500
            missed: '#EF4444'        // red-500
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

        const totalVotes = this.generateRandomData(dataPoints, 50, 56)
        const participatedVotes = totalVotes.map(total =>
            Math.floor(total * (Math.random() * 0.1 + 0.9))
        )

        const chart = new Chart(this.chartTarget, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Participated',
                        data: participatedVotes,
                        backgroundColor: colors.participated,
                        borderRadius: {
                            topLeft: 4,
                            topRight: 4
                        }
                    },
                    {
                        label: 'Missed',
                        data: totalVotes.map((total, i) => total - participatedVotes[i]),
                        backgroundColor: colors.missed,
                        borderRadius: {
                            topLeft: 4,
                            topRight: 4
                        }
                    }
                ]
            },
            options: {
                ...this.getBaseChartOptions(isDark),
                plugins: {
                    ...this.getBaseChartOptions(isDark).plugins,
                    legend: {
                        position: 'top',
                        labels: {
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const datasetLabel = context.dataset.label
                                const value = context.parsed.y
                                const total = totalVotes[context.dataIndex]
                                const percentage = ((value / total) * 100).toFixed(1)
                                return `${datasetLabel}: ${value} (${percentage}%)`
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        stacked: true,
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
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Voting Opportunities',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        grid: {
                            drawBorder: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            stepSize: 10,
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        }
                    }
                },
                barPercentage: 0.7,
                categoryPercentage: 0.9,
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        })

        this.chartInstances.set(this.chartTarget, chart)
    }

    generateRandomData(points, min, max) {
        return Array.from({length: points}, () =>
            Math.floor(Math.random() * (max - min + 1) + min)
        )
    }
}