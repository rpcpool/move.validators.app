import {Controller} from "@hotwired/stimulus";
import {Chart, registerables} from "chart.js";

Chart.register(...registerables);

export default class extends Controller {
    static targets = ["sparkline"];

    connect() {
        // Parse rewards and sequence numbers
        const rewards = JSON.parse(this.element.dataset.rewardsSparklineRewards || "[]");
        const sequences = JSON.parse(this.element.dataset.rewardsSparklineSequences || "[]");

        // Reverse both arrays to show latest data on the right
        const reversedRewards = [...rewards].reverse();
        const reversedSequences = [...sequences].reverse();

        // Initialize the chart
        new Chart(this.sparklineTarget, {
            type: "line",
            data: {
                labels: reversedSequences, // Use reversed sequence numbers as x-axis labels
                datasets: [
                    {
                        data: reversedRewards,
                        borderColor: "#3B82F6", // Tailwind blue-500
                        borderWidth: 2,
                        pointRadius: 1.5,
                        pointHoverRadius: 3,
                        fill: false,
                        tension: 0.3, // Smooth line
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {left: 5, right: 5, top: 0, bottom: 0},
                },
                plugins: {
                    legend: {display: false},
                    tooltip: {enabled: true}, // Enable tooltips to show sequence and reward
                },
                scales: {
                    x: {
                        display: true,
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            padding: 10, // Space between ticks and the axis title
                        },
                        // title: {
                        //     display: true,
                        //     text: "Sequence", // Title for the x-axis
                        //     font: {size: 12},
                        //     color: "#6B7280", // Tailwind gray-500
                        //     align: "bottom", // Center-align the title
                        //     padding: {top: 15}, // Ensure the title is below the ticks
                        // },
                    },
                    y: {
                        display: true, // Display the y-axis
                        ticks: {
                            beginAtZero: true, // Start the y-axis at 0
                            precision: 0, // Only whole numbers
                        },
                        title: {
                            display: true,
                            text: "Rewards", // Label for the y-axis
                            font: {size: 12},
                            color: "#6B7280", // Tailwind gray-500
                        },
                    },
                },
            },
        });
    }
}
