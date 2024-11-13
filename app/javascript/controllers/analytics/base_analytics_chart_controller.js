// app/javascript/controllers/base_chart_controller.js
import {Controller} from "@hotwired/stimulus"
import {Chart, registerables} from "chart.js"

Chart.register(...registerables)

export default class extends Controller {
    chartInstances = new Map()

    connect() {
        this.renderChart()
        this.observeThemeChanges()
    }

    renderChart() {
        console.warn('renderChart() must be implemented in child controller')
    }

    // Child charts must implement their color schemes
    getChartColors() {
        console.warn('getChartColors() must be implemented in child controller')
        return {}
    }

    observeThemeChanges() {
        const observer = new MutationObserver(() => {
            this.clearCharts()
            this.renderChart()
        })

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"]
        })
    }

    clearCharts() {
        this.chartInstances.forEach((chart) => chart.destroy())
        this.chartInstances.clear()
    }

    isDarkMode() {
        return document.documentElement.classList.contains("dark")
    }

    disconnect() {
        this.clearCharts()
    }

    getBaseChartOptions(isDark = this.isDarkMode()) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    },
                    ticks: {
                        color: isDark ? '#9CA3AF' : '#6B7280'
                    }
                },
                y: {
                    grid: {
                        color: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    },
                    ticks: {
                        color: isDark ? '#9CA3AF' : '#6B7280'
                    },
                    title: {
                        color: isDark ? '#9CA3AF' : '#6B7280'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: isDark ? '#9CA3AF' : '#6B7280'
                    }
                }
            }
        }
    }
}