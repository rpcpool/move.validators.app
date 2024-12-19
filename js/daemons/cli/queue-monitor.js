#!/usr/bin/env node

require('dotenv').config();
const blessed = require('blessed');
const Redis = require('redis');
const {snakeCase} = require('case-anything');
const updateMs = 250; // Update every 500ms for smoother RPS calculation

// Create blessed screen
const screen = blessed.screen({
    smartCSR: true,
    title: 'Queue Monitor'
});

// Create request manager box
const requestBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '30%',
    content: '',
    border: {
        type: 'line'
    },
    label: ' Request Manager ',
    style: {
        border: {
            fg: 'green'
        }
    },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
        ch: ' ',
        inverse: true
    },
    mouse: true
});

// Create queue box
const queueBox = blessed.box({
    top: '30%',
    left: 0,
    width: '100%',
    height: '55%',
    content: '',
    border: {
        type: 'line'
    },
    label: ' Job Queues ',
    style: {
        border: {
            fg: 'blue'
        }
    },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
        ch: ' ',
        inverse: true
    },
    mouse: true
});

// Create debug box
const debugBox = blessed.box({
    top: '85%',
    left: 0,
    width: '100%',
    height: '15%',
    content: '',
    border: {
        type: 'line'
    },
    label: ' Debug Log ',
    style: {
        border: {
            fg: 'yellow'
        }
    },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
        ch: ' ',
        inverse: true
    },
    mouse: true,
    keys: true
});

screen.append(requestBox);
screen.append(queueBox);
screen.append(debugBox);

// Quit on Escape, q, or Control-C
screen.key(['escape', 'q', 'C-c'], function (ch, key) {
    return process.exit(0);
});

// Enable scrolling for all boxes
screen.key(['pageup'], function () {
    debugBox.scroll(-debugBox.height || -1);
    screen.render();
});

screen.key(['pagedown'], function () {
    debugBox.scroll(debugBox.height || 1);
    screen.render();
});

// Keep track of debug lines
const maxDebugLines = 100;
let debugLines = [];

function debug(message) {
    // Only show processing and success messages
    if (message.includes('[PROCESSING]') || message.includes('[SUCCESS]')) {
        // Extract timestamp and format message
        const timestamp = message.slice(0, 24); // Keep only the first timestamp
        const urlMatch = message.match(/\[(PROCESSING|SUCCESS)\] (.*?) \(/);
        if (urlMatch) {
            const status = urlMatch[1];
            const url = urlMatch[2];
            const formattedMessage = `${timestamp} [${status}] ${url}`;
            debugLines.push(formattedMessage);

            // Keep only the last maxDebugLines
            if (debugLines.length > maxDebugLines) {
                debugLines = debugLines.slice(-maxDebugLines);
            }

            // Update content and scroll to bottom
            debugBox.setContent(debugLines.join('\n'));
            debugBox.setScrollPerc(100);
            screen.render();
        }
    }
}

let lastTotalRequests = null;
let lastStatsTime = null;

async function updateRequestManagerDisplay(redis) {
    try {
        // Get queue size and monitoring info
        const [queueSize, monitoringInfo] = await Promise.all([
            redis.lLen('request_queue'),
            redis.get('request_manager:monitoring')
        ]);

        let content = '';

        if (monitoringInfo) {
            const info = JSON.parse(monitoringInfo);
            if (info.stats) {
                const rps = info.stats.currentRPS || 0;
                const rateLimitHits = info.stats.rateLimitHits || 0;

                // Color code RPS based on limit (8 RPS)
                let rpsColor;
                if (rps === 0) rpsColor = '\x1b[90m'; // Gray for idle
                else if (rps <= 5) rpsColor = '\x1b[32m'; // Green for normal
                else if (rps <= 7) rpsColor = '\x1b[33m'; // Yellow for warning
                else rpsColor = '\x1b[31m'; // Red for at/over limit

                content += `${rpsColor}${rps} req/s\x1b[0m`.padEnd(20) + `Queue: ${queueSize || 0}\n`;
                content += `Rate Limit Hits: ${rateLimitHits}\n\n`;
                content += `Success: ${info.stats.successfulRequests || 0}`.padEnd(20);
                content += `Failed: ${info.stats.failedRequests || 0}\n`;
                content += `Total: ${info.stats.totalRequests || 0}`;
            }
        }
        requestBox.setContent(content);
    } catch (error) {
        debug(`Error updating request manager display: ${error.message}`);
        requestBox.setContent(`Error fetching request manager data: ${error.message}`);
    }
}

async function updateQueueDisplay(redis) {
    try {
        // First get all queue keys directly
        const keys = await redis.keys('queue:*');
        // Skip debug log for queue keys

        let content = '';

        // Sort keys to keep queue order consistent
        const sortedKeys = keys.sort();

        for (const queueKey of sortedKeys) {
            const length = await redis.lLen(queueKey);
            const queueName = queueKey.replace('queue:', '');
            // Skip debug log for queue length

            // Get all jobs in queue
            const jobs = await redis.lRange(queueKey, 0, -1);

            // Add timestamp to queue header
            content += `\nQueue ${queueName} (${length} jobs) - Last Updated: ${new Date().toLocaleTimeString()} (GMT: ${new Date().toISOString().slice(11, 19)})\n`;

            // Parse and display each job
            jobs.forEach((job, index) => {
                try {
                    const parsed = JSON.parse(job);
                    content += `\nJob ${index + 1}:\n`;
                    content += `Class: ${parsed.class}\n`;
                    content += `JID: ${parsed.jid}\n`;
                    content += `Queue: ${parsed.queue}\n`;

                    // Special handling for ValidatorRewardsJob to show validator count
                    if (parsed.class === 'ValidatorRewardsJob' && parsed.args[0]) {
                        const validatorCount = Object.keys(parsed.args[0]).length;
                        content += `Validators: ${validatorCount}\n`;
                    } else {
                        content += `Args: ${JSON.stringify(parsed.args, null, 2)}\n`;
                    }

                    content += '-'.repeat(50) + '\n';
                } catch (e) {
                    content += `Error parsing job ${index + 1}: ${e.message}\n`;
                    // Skip debug logs for job parsing errors
                }
            });
        }

        if (!content) {
            content = 'No jobs found';
        }

        queueBox.setContent(content);
    } catch (error) {
        debug(`Error updating queue display: ${error.message}`);
        queueBox.setContent(`Error: ${error.message}`);
    }
}

async function updateDisplay(redis) {
    await Promise.all([
        updateRequestManagerDisplay(redis),
        updateQueueDisplay(redis)
    ]);
    screen.render();
}

async function main() {
    const redis = Redis.createClient({
        url: process.env.REDIS_URL
    });

    // Create subscriber client for logs
    const subscriber = redis.duplicate();

    try {
        await Promise.all([
            redis.connect(),
            subscriber.connect()
        ]);
        debug('Connected to Redis');

        // Subscribe to request manager logs
        await subscriber.subscribe('request_manager:logs', (message) => {
            debug(message);
        });

        // Initial update
        await updateDisplay(redis);

        // Update display frequently for accurate RPS
        setInterval(() => updateDisplay(redis), updateMs);

    } catch (error) {
        debug(`Fatal error: ${error.message}`);
        process.exit(1);
    }

    process.on('SIGINT', async () => {
        await Promise.all([
            redis.quit(),
            subscriber.quit()
        ]);
        process.exit(0);
    });
}

main().catch(console.error);
