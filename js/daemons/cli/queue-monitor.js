#!/usr/bin/env node

require('dotenv').config();
const blessed = require('blessed');
const Redis = require('redis');
const {snakeCase} = require('case-anything');

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
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
});

// Enable scrolling for all boxes
screen.key(['pageup'], function() {
    debugBox.scroll(-debugBox.height || -1);
    screen.render();
});

screen.key(['pagedown'], function() {
    debugBox.scroll(debugBox.height || 1);
    screen.render();
});

// Keep track of debug lines
const maxDebugLines = 1000;
let debugLines = [];

function debug(message) {
    const timestamp = new Date().toISOString();
    const line = `${timestamp} ${message}`;
    
    // Add to our lines array
    debugLines.push(line);
    
    // Keep only the last maxDebugLines
    if (debugLines.length > maxDebugLines) {
        debugLines = debugLines.slice(-maxDebugLines);
    }
    
    // Update content and scroll to bottom
    debugBox.setContent(debugLines.join('\n'));
    debugBox.setScrollPerc(100);
    screen.render();
}

async function updateRequestManagerDisplay(redis) {
    try {
        // Get monitoring info
        const monitoringInfo = await redis.get('request_manager:monitoring');
        debug(`Raw monitoring info: ${monitoringInfo}`);
        
        let data = {
            stats: {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                duplicateRequests: 0,
                currentQueueSize: 0,
                averageResponseTime: 0,
                totalResponseTime: 0,
                lastUpdated: Date.now()
            },
            activeRequests: [],
            queueSize: 0,
            currentRate: 0,
            maxRate: 0,
            lastUpdated: Date.now()
        };

        if (monitoringInfo) {
            try {
                data = JSON.parse(monitoringInfo);
                debug(`Parsed monitoring info - Queue size: ${data.queueSize}, Active requests: ${data.activeRequests.length}`);
            } catch (e) {
                debug(`Error parsing monitoring info: ${e.message}`);
            }
        }

        let content = '';

        // Display queue status
        content += `Request Queue Status:\n`;
        content += `Current Size: ${data.queueSize}\n`;
        content += `Rate Limit Status: ${data.currentRate}/${data.maxRate} requests\n`;
        content += `Last Update: ${new Date(data.lastUpdated).toLocaleTimeString()}\n\n`;

        // Display stats
        content += `Request Statistics:\n`;
        content += `Total Requests: ${data.stats.totalRequests}\n`;
        content += `Successful: ${data.stats.successfulRequests}\n`;
        content += `Failed: ${data.stats.failedRequests}\n`;
        content += `Duplicates: ${data.stats.duplicateRequests}\n`;
        content += `Avg Response Time: ${Math.round(data.stats.averageResponseTime)}ms\n\n`;

        // Display active requests
        content += `Active Requests (${data.activeRequests.length}):\n`;
        data.activeRequests.forEach(req => {
            content += `[${req.caller}] ${req.url} (${req.elapsedMs}ms)\n`;
        });

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
        debug(`Found queue keys: ${keys.join(', ')}`);
        
        let content = '';
        
        for (const queueKey of keys) {
            const length = await redis.lLen(queueKey);
            const queueName = queueKey.replace('queue:', '');
            debug(`Queue ${queueName} length: ${length}`);
            
            // Get all jobs in queue
            const jobs = await redis.lRange(queueKey, 0, -1);
            
            content += `\nQueue ${queueName} (${length} jobs):\n`;
            
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
                    debug(`Error parsing job: ${e.message}`);
                    debug(`Raw job data: ${job}`);
                }
            });
        }
        
        if (!content) {
            content = 'No queues found';
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

    try {
        await redis.connect();
        debug('Connected to Redis');
        
        // Initial update
        await updateDisplay(redis);
        
        // Update every second
        setInterval(() => updateDisplay(redis), 1000);
        
    } catch (error) {
        debug(`Fatal error: ${error.message}`);
        process.exit(1);
    }

    process.on('SIGINT', async () => {
        await redis.quit();
        process.exit(0);
    });
}

main().catch(console.error);
