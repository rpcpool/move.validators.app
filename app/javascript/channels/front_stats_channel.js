// import consumer from "./consumer"
//
// consumer.subscriptions.create({ channel: "FrontStatsChannel" }, {
//   received(data) {
//     this.insertAptPrice(parseFloat(data['aptos']['usd']))
//     this.insert24HChange(data['aptos']['usd_24h_change'])
//     this.insert24HVolume(data['aptos']['usd_24h_vol'])
//   },
//
//   insertAptPrice(price) {
//     const el = document.querySelector("#apt-price")
//     el.textContent = `$ ${price}`
//   },
//
//   insert24HChange(change) {
//     const el = document.querySelector('#apt-24h-change')
//
//     el.textContent = parseFloat(change + '%')
//
//     if (change > 0) {
//       // positive, so green color
//       el.classList.remove('text-rose-600')
//       el.classList.add('text-green-600')
//     } else {
//       // negative, so red color
//       el.classList.remove('text-green-600')
//       el.classList.add('text-rose-600')
//     }
//   },
//
//   insert24HVolume(change) {
//     const el = document.querySelector('#apt-24h-volume')
//     el.textContent = '$ ' + parseFloat((change / 1000000).toLocaleString()) + 'M'
//   }
// })

import consumer from "./consumer"

consumer.subscriptions.create("FrontStatsChannel", {
    connected() {
        console.log("Connected to FrontStatsChannel");
    },

    disconnected() {
        // Called when the subscription has been terminated by the server
    },

    received(data) {
        if (data.type === "validator_update") {
            const nameElement = document.getElementById('validator-name');
            const addressElement = document.getElementById('validator-address');

            nameElement.textContent = data.name;
            addressElement.textContent = data.address;

            // Add the fade-in class to trigger the animation
            nameElement.classList.add('fade-in');
            addressElement.classList.add('fade-in');

            // Remove the fade-in class after the animation completes
            setTimeout(() => {
                nameElement.classList.remove('fade-in');
                addressElement.classList.remove('fade-in');
            }, 5000);
        }
        // Handle other types of updates if needed
    }
});

// CSS for fade effect
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { opacity: 0; }
  }

  .fade-in {
    animation: fadeInOut 5s ease-in-out;
  }
`;
document.head.appendChild(style);