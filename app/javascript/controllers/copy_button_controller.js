import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["button"]
  static values = {
    text: String
  }

  copy() {
    navigator.clipboard.writeText(this.textValue).then(() => {
      this.buttonTarget.classList.add('animate-spin-and-fade')
      setTimeout(() => {
        this.buttonTarget.classList.remove('animate-spin-and-fade')
      }, 1000)
    }).catch(err => {
      console.error('Failed to copy text: ', err)
    })
  }
}
