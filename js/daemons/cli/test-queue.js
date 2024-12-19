#!/usr/bin/env node

require('dotenv').config();
const Redis = require('redis');
const { snakeCase } = require('case-anything');

async function addTestJob(redis) {
    // Create a test job
    const payload = {
        class: 'TestWorker',
        jid: Date.now().toString(),
        queue: 'default',
        args: [{ test: true, timestamp: new Date().toISOString() }],
        expires_in: 300
    };

    // Add to queue
    const queueKey = `queue:${snakeCase('default')}`;
    await redis.lPush(queueKey, JSON.stringify(payload));
    await redis.sAdd('queues', 'default');

    console.log('Added test job to queue:', payload.jid);
}

async function main() {
    const redis = Redis.createClient({
        url: process.env.REDIS_URL
    });

    await redis.connect();

    // Add a job every 2 seconds
    await addTestJob(redis);
    const interval = setInterval(async () => {
        try {
            await addTestJob(redis);
        } catch (error) {
            console.error('Error adding job:', error);
            clearInterval(interval);
            redis.quit();
            process.exit(1);
        }
    }, 2000);

    // Handle cleanup
    process.on('SIGINT', async () => {
        clearInterval(interval);
        await redis.quit();
        process.exit();
    });
}

main().catch(console.error);
