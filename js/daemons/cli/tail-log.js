const fs = require('fs');
const readline = require('readline');
const path = require('path');

const logFile = path.join(process.cwd(), 'logs', 'request-processor-current.log');
const bodyLength = 100;

function createReadInterface() {
    const stream = fs.createReadStream(logFile, {
        encoding: 'utf8'
    });

    const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
    });

    // When we reach the end, keep the interface open
    stream.on('end', () => {
        rl.pause();
    });

    return {stream, rl};
}

// Format timestamp to ISO string
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    // Convert unix timestamp (number or string) to ISO
    if (/^\d+$/.test(timestamp.toString())) {
        return new Date(parseInt(timestamp)).toISOString();
    }
    return timestamp;
}

// Parse and format body content
function formatBody(body) {
    if (!body) return null;
    try {
        // Try to parse if it's a JSON string
        const parsed = JSON.parse(body);
        // Get first 4 fields sorted alphabetically
        const fields = Object.keys(parsed)
            .sort()
            .slice(0, 4)
            .map(key => parsed[key]);
        if (fields.length > 0) {
            return `[${fields.join(', ')}]`;
        }
        return null;
    } catch (e) {
        // If not JSON or parsing fails, return truncated original
        return body.length > bodyLength ? body.substring(0, bodyLength) + '...' : body;
    }
}

// Format the log entry
function formatLogEntry(entry) {
    try {
        const data = JSON.parse(entry);
        const timestamp = formatTimestamp(data.timestamp);
        const source = data.source || '';

        // no source, no log
        if (!source || source === '') return undefined;

        const requestId = data.requestId || '';
        const url = data.url || '';
        const error = data.error ?
            (data.error.message || JSON.stringify(data.error)) :
            '';
        const body = data.body ? formatBody(data.body) : null;

        // Build parts of the log line
        const parts = [timestamp, source, requestId, url];

        // Add body or error if they exist
        if (body) {
            parts.push(body);
        }
        if (error) {
            parts.push(error);
        }

        // Join with ' | ' separator
        return parts.join(' | ');
    } catch (err) {
        return entry; // Return original line if parsing fails
    }
}

// Create logs directory if it doesn't exist
const logsDir = path.dirname(logFile);
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, {recursive: true});
}

// Create empty log file if it doesn't exist
if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '');
}

// Initial setup
let {stream, rl} = createReadInterface();

// Watch for new lines
rl.on('line', (line) => {
    const entry = formatLogEntry(line);
    if (entry !== undefined) console.log(entry);
});

// Watch for file changes
fs.watch(logFile, (eventType) => {
    if (eventType === 'change') {
        // Close existing interface
        rl.close();
        stream.destroy();

        // Create new interface to read new content
        const newInterfaces = createReadInterface();
        stream = newInterfaces.stream;
        rl = newInterfaces.rl;

        // Set up line handler for new interface
        rl.on('line', (line) => {
            const entry = formatLogEntry(line);
            if (entry !== undefined) console.log(entry);
        });
    }
});

console.log(`Tailing ${logFile}...`);

// to run: node daemons/cli/tail-log.js
