import BaseAnalyticsChartController from "controllers/base_analytics_chart_controller"
import {Chart} from "chart.js"

export default class extends BaseAnalyticsChartController {
    static targets = ["chart"]
    static values = {
        address: String
    }

    connect() {
        this.loadChartData()
    }

    getChartColors() {
        return {
            overall: '#667EEA',    // blue
            performance: '#9F7AEA', // purple
            rewards: '#3ABAB4'   // indigo
        }
    }

    async loadChartData() {
        try {
            const response = await fetch(`/validators/${this.addressValue}/performance_metrics`)
            if (!response.ok) throw new Error('Network response was not ok')
            const data = await response.json()
            if (data && data.length > 0) {
                this.renderChart(data)
            } else {
                console.error('No data received from performance metrics endpoint')
            }
        } catch (error) {
            console.error('Error loading performance metrics:', error)
        }
    }

    renderChart(data) {
        const isDark = this.isDarkMode()
        const colors = this.getChartColors()

        if (this.chartInstances.has(this.chartTarget)) {
            this.chartInstances.get(this.chartTarget).destroy()
        }

        const labels = data.map(item => item.period)
        const datasets = [
            {
                label: 'Overall Score',
                data: data.map(item => item.metrics.overall_score),
                backgroundColor: colors.overall,
                borderRadius: 4,
                order: 1
            },
            {
                label: 'Block Performance',
                data: data.map(item => item.metrics.block_performance),
                backgroundColor: colors.performance,
                borderRadius: 4,
                order: 2
            },
            {
                label: 'Rewards Growth',
                data: data.map(item => item.metrics.rewards_growth),
                backgroundColor: colors.rewards,
                borderRadius: 4,
                order: 3,
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.raw
                            const growthPercent = ((value - 50) * 2).toFixed(1)
                            return `Rewards Growth: ${growthPercent}%`
                        }
                    }
                }
            }
        ]

        const chart = new Chart(this.chartTarget, {
            type: 'bar',
            data: {
                labels,
                datasets
            },
            options: {
                ...this.getBaseChartOptions(isDark),
                plugins: {
                    ...this.getBaseChartOptions(isDark).plugins,
                    legend: {
                        position: 'top',
                        onClick: (evt, legendItem, legend) => {
                            const index = legendItem.datasetIndex
                            const ci = legend.chart

                            if (ci.isDatasetVisible(index)) {
                                ci.hide(index)
                                legendItem.hidden = true
                            } else {
                                ci.show(index)
                                legendItem.hidden = false
                            }

                            // Store visibility state in localStorage
                            const visibility = {
                                'Overall Score': ci.isDatasetVisible(0),
                                'Block Performance': ci.isDatasetVisible(1),
                                'Rewards Growth': ci.isDatasetVisible(2)
                            }
                            localStorage.setItem('performanceMetricsVisibility', JSON.stringify(visibility))

                            ci.update()
                        },
                        labels: {
                            color: isDark ? '#9CA3AF' : '#6B7280',
                            usePointStyle: true,
                            pointStyle: 'rect',
                            padding: 15,
                            generateLabels: (chart) => {
                                // Get default labels
                                const original = Chart.defaults.plugins.legend.labels.generateLabels(chart)

                                // Load saved visibility state
                                const savedVisibility = JSON.parse(localStorage.getItem('performanceMetricsVisibility'))
                                if (savedVisibility) {
                                    original.forEach(label => {
                                        label.hidden = !savedVisibility[label.text]
                                    })
                                }

                                return original
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
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
                            text: 'Score',
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        suggestedMin: 0,
                        suggestedMax: 100,
                        beginAtZero: true,
                        grid: {
                            drawBorder: false,
                            color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: isDark ? '#9CA3AF' : '#6B7280',
                            callback: function (value) {
                                if (this.chart.data.datasets[2].label === 'Rewards Growth') {
                                    return `${((value - 50) * 2)}%`
                                }
                                return value
                            },
                        }
                    }
                },
                barPercentage: 0.8,
                categoryPercentage: 0.9,
                responsive: true
            }
        })

        // Set initial visibility based on saved state
        const savedVisibility = JSON.parse(localStorage.getItem('performanceMetricsVisibility'))
        if (savedVisibility) {
            Object.entries(savedVisibility).forEach(([label, isVisible], index) => {
                if (!isVisible) {
                    chart.hide(index)
                }
            })
            chart.update()
        }

        this.chartInstances.set(this.chartTarget, chart)
    }
}