const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const {paddingChars} = require("../utils");

class FileLog {
    constructor(options = {}) {
        const {
            filename = 'app',
            maxSize = '20m',
            maxFiles = '14d',
            dirname = 'logs',
        } = options;

        this.classNamePadding = paddingChars;
        this.className = filename; // Use filename as class name for logging

        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({timestamp, level, message, ...meta}) => {
                    // Pad the class name for consistent alignment
                    const paddedClassName = this.padClassName(this.className);
                    // Ensure meta data is stringified properly
                    const metaString = Object.keys(meta).length ?
                        ` ${JSON.stringify(meta, null, 0)}` : '';
                    return `${timestamp} ${paddedClassName}${message}${metaString}`;
                })
            ),
            transports: [
                new winston.transports.DailyRotateFile({
                    filename: path.join(dirname, `${filename}-%DATE%.log`),
                    datePattern: 'YYYY-MM-DD',
                    maxSize,
                    maxFiles,
                    // Create the directory if it doesn't exist
                    createSymlink: true,
                    symlinkName: `${filename}-current.log`,
                    // Handle unhandled errors
                    handleExceptions: true,
                    // JSON formatting for better parsing
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                })
            ]
        });
    }

    padClassName(name) {
        const prefix = `[${name}] `;
        return prefix.padEnd(this.classNamePadding);
    }

    truncate(str, maxLength = 200) {
        if (!str) return str;
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    }

    formatError(error) {
        if (!error) return null;
        return {
            message: error.message,
            stack: error.stack,
            ...error
        };
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    error(message, error = null, meta = {}) {
        this.logger.error(message, {
            ...meta,
            error: this.formatError(error)
        });
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Specific method for logging requests
    logRequest(source, url, requestData = {}) {
        this.info(`[${requestData.id}] > ${source} request: ${url}`, {
            requestId: requestData.id,
            queue: 'request_queue',
            responseQueue: requestData.responseQueue,
            timestamp: requestData.timestamp
        });
    }

    // Specific method for logging responses
    logResponse(source, url, responseData = {}, requestId) {
        const status = responseData.status || 'unknown';
        this.info(`[${requestId}] < ${source} response (${status}): ${url}`, {
            requestId,
            status,
            responseQueue: responseData.responseQueue,
            // Truncate response body if present
            body: responseData.body ? this.truncate(responseData.body) : null
        });
    }
}

module.exports = FileLog;
