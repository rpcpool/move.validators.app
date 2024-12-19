// app/javascript/controllers/validator_donut_chart_controller.js
import {Controller} from "@hotwired/stimulus";
import {Chart, registerables} from "chart.js";

Chart.register(...registerables);

export default class extends Controller {
    static targets = [
        "overallScore",
        "votingRecord",
        "lastEpochBlocks",
        "blockPerformance",
        "datacenterScore"
    ];

    // static values = {
    //     overallScore: Number
    // }

    chartInstances = new Map(); // Store chart instances

    connect() {
        this.renderAllCharts();

        // Watch for theme changes and re-render charts
        this.observeThemeChanges();
    }

    renderAllCharts() {
        const isDarkMode = this.isDarkMode();

        // Render charts with different colors for each metric
        const overallScore = this.getChildValue(this.overallScoreTarget, "overall-score");
        const overallValue = parseFloat(overallScore) || 0;
        this.renderDonutChart(
            this.overallScoreTarget,
            "Overall Score",
            [overallValue, 100 - overallValue],
            "#3ABAB4",
            "#E6FFFA",
            isDarkMode
        );

        const votingRecord = this.getChildValue(this.votingRecordTarget, "voting-record");
        const [current, max] = votingRecord.split(" / ").map(Number);
        // Handle 0/0 case by showing empty donut
        const votingData = max === 0 ? [0, 100] : [current, max - current];
        this.renderDonutChart(
            this.votingRecordTarget,
            "Voting Record",
            votingData,
            "#9F7AEA",
            "#FAF5FF",
            isDarkMode
        );

        const lastEpochBlocks = this.getChildValue(this.lastEpochBlocksTarget, "last-epoch-blocks");
        const lastEpochValue = parseFloat(lastEpochBlocks) || 0;
        this.renderDonutChart(
            this.lastEpochBlocksTarget,
            "Last Epoch Performance",
            [lastEpochValue, 100 - lastEpochValue],
            "#667EEA",
            "#EBF4FF",
            isDarkMode,
            true
        );

        const blockPerformance = this.getChildValue(this.blockPerformanceTarget, "block-performance");
        const perfValue = parseFloat(blockPerformance) || 0;
        this.renderDonutChart(
            this.blockPerformanceTarget,
            "Block Performance",
            [perfValue, 100 - perfValue],
            "#ED64A6",
            "#FFF5F7",
            isDarkMode,
            true
        );

        const datacenterScore = this.getChildValue(this.datacenterScoreTarget, "datacenter-score");
        const datacenterValue = parseFloat(datacenterScore) || 0;
        this.renderDonutChart(
            this.datacenterScoreTarget,
            "Datacenter Score",
            [datacenterValue, 100 - datacenterValue],
            "#F6E05E",
            "#FEFCBF",
            isDarkMode
        );
    }

    // Helper to fetch data values by key from dataset attributes
    getChildValue(target, key) {
        const element = target.closest(`[data-validator-donut-chart-${key}-value]`);
        return element.dataset[`validatorDonutChart${this.capitalize(key)}Value`];
    }

    // Render donut chart with dynamic colors
    renderDonutChart(target, label, data, primaryColor, lightColor, isDarkMode, showPercentage = false) {
        if (this.chartInstances.has(target)) {
            this.chartInstances.get(target).destroy(); // Destroy existing chart
            this.chartInstances.delete(target);
        }

        // Ensure the canvas height does not change
        target.height = 100;
        target.width = 100;

        const chart = new Chart(target, {
            type: "doughnut",
            data: {
                labels: [label, "Remaining"],
                datasets: [
                    {
                        data: data,
                        backgroundColor: [primaryColor, lightColor],
                        borderColor: isDarkMode ? "#5b5b66" : "#fafafa",
                        hoverOffset: 4,
                    },
                ],
            },
            options: {
                responsive: false, // Disable auto-resizing
                maintainAspectRatio: true, // Keep aspect ratio
                plugins: {legend: {display: false}},
            },
        });

        this.chartInstances.set(target, chart); // Store the chart instance

        // Update the display value with percentage if needed
        if (showPercentage) {
            const displayElement = target.closest('dd').querySelector('.text-gray-500');
            if (displayElement) {
                const value = isNaN(data[0]) ? '0' : data[0];
                displayElement.textContent = `${value}%`;
            }
        }
    }

    observeThemeChanges() {
        const observer = new MutationObserver(() => {
            // Re-render all charts on theme change
            this.clearCharts();
            this.renderAllCharts();
        });

        // Observe changes to the 'class' attribute of the <html> element
        observer.observe(document.documentElement, {attributes: true, attributeFilter: ["class"]});
    }

    clearCharts() {
        // Destroy all existing chart instances
        this.chartInstances.forEach((chart) => chart.destroy());
        this.chartInstances.clear();
    }

    capitalize(str) {
        return str.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase());
    }

    // Helper to determine if dark mode is active
    isDarkMode() {
        return document.documentElement.classList.contains("dark");
    }

    disconnect() {
        this.clearCharts();
    }
}
