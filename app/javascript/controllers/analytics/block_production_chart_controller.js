// app/javascript/controllers/analytics/block_production_chart_controller.js
import BaseAnalyticsChartController from "./base_analytics_chart_controller"
import {Chart} from "chart.js"

export default class extends BaseAnalyticsChartController {
    static targets = ["chart"]

    getChartColors() {
        return {
            bars: '#6366F1' // indigo-500
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
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Blocks Per Day',
                    data: this.generateRandomData(dataPoints, 800, 2000),
                    backgroundColor: colors.bars,
                    borderRadius: 4
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
                            label: (context) => `${context.parsed.y.toFixed(0)} blocks`
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
                            text: 'Daily Blocks',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        grid: {
                            drawBorder: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: (value) => value.toFixed(0),
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        }
                    }
                },
                barPercentage: 0.7,
                categoryPercentage: 0.9
            }
        })

        this.chartInstances.set(this.chartTarget, chart)
    }

    generateRandomData(points, min, max) {
        return Array.from({length: points}, () =>
            Number((Math.random() * (max - min) + min).toFixed(0))
        )
    }
}