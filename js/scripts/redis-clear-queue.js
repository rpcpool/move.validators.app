#!/usr/bin/env node

const Redis = require('redis');

async function clearQueue() {
  const client = Redis.createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: true,
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to Redis');

    // Get queue size before clearing
    const size = await client.lLen('queue:block_fetch_request');
    console.log(`Current queue size: ${size}`);

    if (size > 0) {
      // Sample first item to see what's in queue
      const sample = await client.lIndex('queue:block_fetch_request', 0);
      console.log('Sample item:', JSON.parse(sample));

      // Clear the queue
      const result = await client.del('queue:block_fetch_request');
      console.log(`Cleared queue:block_fetch_request (deleted ${result} entries)`);
    } else {
      console.log('Queue is already empty');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.quit();
  }
}

clearQueue().catch(console.error);
