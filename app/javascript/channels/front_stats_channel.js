import consumer from "./consumer"

consumer.subscriptions.create({ channel: "FrontStatsChannel" }, {
  received(data) {
    console.log('received', data)
    this.insertAptPrice(parseFloat(data['aptos']['usd'].toFixed(2)))
    this.insert24HChange(data['aptos']['usd_24h_change'])
    this.insert24HVolume(data['aptos']['usd_24h_vol'])
  },

  insertAptPrice(price) {
    const el = document.querySelector("#apt-price")
    el.textContent = `$ ${price}`
  },

  insert24HChange(change) {
    const el = document.querySelector('#apt-24h-change')

    el.textContent = parseFloat(change.toFixed(2)) + '%'

    if (change > 0) {
      // positive, so green color
      el.classList.remove('text-rose-600')
      el.classList.add('text-green-600')
    } else {
      // negative, so red color
      el.classList.remove('text-green-600')
      el.classList.add('text-rose-600')
    }
  },

  insert24HVolume(change) {
    const el = document.querySelector('#apt-24h-volume')

    el.textContent = '$ ' + parseFloat((change / 1000000).toFixed(2)).toLocaleString() + 'M'

  }
})