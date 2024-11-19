module.exports = {
    apps: [
        {
            name: "block-proposals",
            script: "./daemons/block-proposals.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "block-update-fetch",
            script: "./daemons/block-update-fetch.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        // do this one first:
        {
            name: "coingecko-prices",
            script: "./daemons/coingecko-prices.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "epoch-backfiller",
            script: "./daemons/epoch-backfiller.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "epoch-history",
            script: "./daemons/epoch-history.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "ledger-info",
            script: "./daemons/ledger-info.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "stake-history",
            script: "./daemons/stake-history.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "transactions",
            script: "./daemons/transactions.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "validator-rewards",
            script: "./daemons/validator-rewards.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "validator-votes",
            script: "./daemons/validator-votes.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        },
        {
            name: "validators-list",
            script: "./daemons/validators-list.js",
            instances: 1,
            exec_mode: "fork",
            watch: false
        }
    ],
    deploy: {
        production: {
            user: 'deploy',
            host: 'www2.move.validators.app',
            path: '/home/deploy/move.validators.app/current/js',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
        },
        env: {
            NODE_ENV: 'production',
            APTOS_NETWORK: 'mainnet',
            REDIS_URL: "redis://app-server-1:6379/1"
        },
    }
};