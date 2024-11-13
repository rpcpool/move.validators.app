import {Controller} from "@hotwired/stimulus";

export default class extends Controller {
    static targets = ["info"];

    connect() {
        if (!this.infoTarget) {
            console.error("Info target not found!");
        }
    }

    show(event) {
        const name = event.currentTarget.getAttribute("data-name");
        const value = event.currentTarget.getAttribute("data-value");
        const rect = event.currentTarget.getBoundingClientRect();
        const tooltip = this.infoTarget;

        // Ensure tooltip is visible briefly to calculate dimensions
        tooltip.classList.remove("hidden");
        tooltip.textContent = `${name}: ${value}`;

        // Calculate tooltip dimensions AFTER it is unhidden
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;

        // Default positioning: Left of the hovered element
        let leftPosition = rect.left - tooltipWidth - 10;
        let topPosition = rect.top + (rect.height / 2) - (tooltipHeight / 2);

        // Adjust if the tooltip goes off-screen on the left
        if (leftPosition < 0) {
            leftPosition = rect.right + 10; // Move to the right if it doesn't fit on the left
        }

        // Apply the calculated positions
        tooltip.style.left = `${leftPosition}px`;
        tooltip.style.top = `${topPosition}px`;
    }

    hide() {
        // Hide the tooltip on mouse leave
        this.infoTarget.classList.add("hidden");
    }
}
