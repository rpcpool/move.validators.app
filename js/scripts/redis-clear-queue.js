#!/usr/bin/env node

const Redis = require('redis');

const parseArgs = require('minimist');

// Parse command line arguments
const argv = parseArgs(process.argv.slice(2), {
    string: ['_'] // treat positional args as strings
});

console.log("argv:", argv);

const options = {
    dryRun: argv._.includes('dry-run'),
    queueName: argv._[0] || null,
    count: argv._[1] ? parseInt(argv._[1]) : null
};

if (argv._[1] && isNaN(options.count)) {
    console.error('Error: count must be a number');
    process.exit(1);
}

const {dryRun, queueName, count} = options;

// console.log('Parsed arguments:', {dryRun, queueName, count});

async function listQueues() {
    const client = Redis.createClient({
        url: process.env.REDIS_URL
    });

    try {
        await client.connect();
        console.log('Connected to Redis');

        // Get all queue keys
        const keys = await client.keys('queue:*');

        if (keys.length === 0) {
            console.log('\nNo queues found');
            return;
        }

        console.log('\nAvailable queues:');
        for (const key of keys.sort()) {
            const size = await client.lLen(key);
            const queueName = key.replace('queue:', '');
            console.log(`  ${queueName}: ${size} items`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.quit();
    }
}

if (!queueName) {
    console.log('Usage: npm run redis-clear-queue [queue-name] [count] [--dry-run]');
    console.log('Example: npm run redis-clear-queue block_fetch_request 100 --dry-run');
    console.log('\nOptions:');
    console.log('  queue-name: Name of queue to clear (required)');
    console.log('  count: Number of items to remove (optional, removes all if not specified)');
    console.log('  --dry-run: Preview what would be deleted without actually deleting');
    console.log('\nListing available queues...\n');

    listQueues().catch(console.error);
    return;
}

async function clearQueue() {
    const client = Redis.createClient({
        url: process.env.REDIS_URL
    });

    try {
        await client.connect();
        console.log('Connected to Redis');

        const fullQueueName = `queue:${queueName}`;

        // Get queue size before clearing
        const size = await client.lLen(fullQueueName);
        console.log(`\nQueue: ${fullQueueName}`);
        console.log(`Current size: ${size}`);

        if (size === 0) {
            console.log('Queue is already empty');
            return;
        }

        // Show sample of items
        const sampleSize = Math.min(3, size);
        console.log(`\nShowing ${sampleSize} sample items:`);
        for (let i = 0; i < sampleSize; i++) {
            const item = await client.lIndex(fullQueueName, i);
            console.log(`\nItem ${i + 1}:`, JSON.parse(item));
        }

        // Preview what will be removed
        const itemsToRemove = count || size;
        console.log(`\n${dryRun ? '[DRY RUN]' : ''} Will remove ${itemsToRemove} items from ${fullQueueName}`);

        // In dry run mode, just show what would happen
        if (dryRun) {
            if (count) {
                console.log(`Would remove ${count} items from the front of the queue`);
            } else {
                console.log(`Would clear entire queue (${size} items)`);
            }
            console.log('No items were actually removed (dry run)');
            return;
        }

        // Actually remove items
        if (count) {
            // Remove specific number of items from the left
            for (let i = 0; i < count; i++) {
                await client.lPop(fullQueueName);
            }
            console.log(`Removed ${count} items from the queue`);
        } else {
            // Remove entire queue
            const result = await client.del(fullQueueName);
            console.log(`Cleared entire queue (deleted ${result} entries)`);
        }

        // Show new size
        const newSize = await client.lLen(fullQueueName);
        console.log(`New queue size: ${newSize}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.quit();
    }
}

clearQueue().catch(console.error);
