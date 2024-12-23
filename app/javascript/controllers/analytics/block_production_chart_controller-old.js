import BaseAnalyticsChartController from "./base_analytics_chart_controller.js"
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
            bars: '#6366F1' // indigo-500
        }
    }

    async loadChartData() {
        try {
            const response = await fetch(`/validators/${this.addressValue}/block_production`)
            if (!response.ok) throw new Error('Network response was not ok')
            const data = await response.json()
            if (data && data.length > 0) {
                this.renderChart(data)
            } else {
                console.error('No data received from block production endpoint')
            }
        } catch (error) {
            console.error('Error loading block production data:', error)
        }
    }

    renderChart(data) {
        const isDark = this.isDarkMode()
        const colors = this.getChartColors()

        if (this.chartInstances.has(this.chartTarget)) {
            this.chartInstances.get(this.chartTarget).destroy()
        }

        const chart = new Chart(this.chartTarget, {
            type: 'bar',
            data: {
                labels: data.map(item => `Epoch ${item.epoch}`),
                datasets: [{
                    label: 'Blocks Per Epoch',
                    data: data.map(item => item.block_count),
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
                            text: 'Blocks Per Epoch',
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
}