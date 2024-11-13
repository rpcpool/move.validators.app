import {Controller} from "@hotwired/stimulus"
import {Turbo} from "@hotwired/turbo-rails"

export default class extends Controller {
    connect() {
        this.bindClickEvents();
    }

    bindClickEvents() {
        const clickableRows = this.element.querySelectorAll('tr[data-link]');
        clickableRows.forEach(row => {
            row.addEventListener('click', this.handleClick.bind(this));
            row.style.cursor = 'pointer';
        });
    }

    handleClick(event) {
        const link = event.currentTarget.dataset.link;
        if (link) {
            Turbo.visit(link);
        }
    }
}