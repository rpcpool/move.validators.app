import consumer from "./consumer"

consumer.subscriptions.create({ channel: "FrontStatsChannel" }, {
  received(data) {
    console.log('received', data)
    this.insertAptPrice(data['aptos']['usd'])
  },

  insertAptPrice(price) {
    const element = document.querySelector("#apt-price")
    element.textContent = `$ ${price}`
  },

  appendLine(data) {
    const html = this.createLine(data)
    const element = document.querySelector("[data-chat-room='Best Room']")
    element.insertAdjacentHTML("beforeend", html)
  },

  createLine(data) {
    return `
      <article class="chat-line">
        <span class="speaker">${data["sent_by"]}</span>
        <span class="body">${data["body"]}</span>
      </article>
    `
  }
})