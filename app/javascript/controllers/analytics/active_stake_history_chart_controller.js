import BaseAnalyticsChartController from "../base_analytics_chart_controller.js"
import {Chart} from "chart.js"

export default class extends BaseAnalyticsChartController {
    static targets = ["chart", "epochRange"]
    static values = {
        address: String
    }

    connect() {
        const selectElement = this.epochRangeTarget
        if (selectElement.options.length > 0) {
            selectElement.selectedIndex = 0 // defaults to 5
            this.loadChartData(selectElement.value)
        }
    }

    getChartColors() {
        const isDark = this.isDarkMode()
        return {
            active: '#8B5CF6',
            withdrawn: '#EF4444',
            added: '#10B981',
            background: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)'
        }
    }

    updateEpochRange(event) {
        this.loadChartData(event.target.value)
    }

    async loadChartData(epochRange) {
        try {
            const response = await fetch(`/validators/${this.addressValue}/active_stake_history?epoch_range=${epochRange}`)
            if (!response.ok) throw new Error('Network response was not ok')
            const data = await response.json()

            if (data.data?.length > 0) {
                this.epochRangeTarget.value = data.epoch_range
                this.renderChart(data.data)
            }
        } catch (error) {
            console.error('Error loading stake history data:', error)
        }
    }

    renderChart(data) {
        const isDark = this.isDarkMode()
        const colors = this.getChartColors()

        if (this.chartInstances.has(this.chartTarget)) {
            this.chartInstances.get(this.chartTarget).destroy()
        }

        const chart = new Chart(this.chartTarget, {
            type: 'line',
            data: {
                labels: data.map(item => `Epoch ${item.epoch}`),
                datasets: [{
                    label: 'Current Stake',
                    data: data.map(item => item.current_stake / 100_000_000),
                    backgroundColor: colors.background,
                    borderColor: colors.active,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                }, {
                    label: 'Withdrawn',
                    data: data.map(item => item.withdrawn / 100_000_000),
                    borderColor: colors.withdrawn,
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }, {
                    label: 'Added',
                    data: data.map(item => item.added / 100_000_000),
                    borderColor: colors.added,
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                }]
            },
            options: {
                ...this.getBaseChartOptions(isDark),
                maintainAspectRatio: true,
                aspectRatio: 2,
                height: 256,
                plugins: {
                    ...this.getBaseChartOptions(isDark).plugins,
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = Number(context.raw)
                                return `${context.dataset.label}: ${value >= 1000 ?
                                    `${(value / 1000).toFixed(1)}K` : value.toFixed(2)} APT`
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
                            text: 'Stake Amount (APT)',
                            font: {size: 12},
                            color: isDark ? '#9CA3AF' : '#6B7280'
                        },
                        ticks: {
                            callback: (value) => {
                                return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(2)
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
}