#!/usr/bin/env node

const Redis = require('redis');

async function checkMemory() {
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

    // Get memory info
    const info = await client.info('memory');
    console.log('\nMemory Info:');
    console.log(info);

    // Get queue sizes
    const keys = await client.keys('queue:*');
    console.log('\nQueue Sizes:');
    for (const key of keys) {
      const size = await client.lLen(key);
      console.log(`${key}: ${size} items`);
    }

    // Get total keys
    const dbSize = await client.dbSize();
    console.log(`\nTotal Keys: ${dbSize}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.quit();
  }
}

checkMemory().catch(console.error);
