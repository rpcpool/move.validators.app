const {execSync} = require('child_process');

class AptosCliWrapper {
    constructor() {
        this.appName = 'aptos node';
    }

    execute(command, params) {
        try {
            // Transform command from camelCase to snake-case
            const transformedCommand = command.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

            // Build the command string
            let fullCommand = `${this.appName} ${transformedCommand}`;

            // Add parameters
            for (const [key, value] of Object.entries(params)) {
                const paramKey = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
                fullCommand += ` --${paramKey} ${value}`;
            }

            // Execute the command
            let output = execSync(fullCommand, {encoding: 'utf-8'});
            const jsonStartIndex = output.indexOf('{');
            if (jsonStartIndex !== -1) {
                output = output.substring(jsonStartIndex);
            }

            if (params.debug) console.log(fullCommand, output);

            // Parse the JSON output
            return JSON.parse(output);
        } catch (error) {
            // Handle errors
            return {
                error: true,
                message: error.message,
                stderr: error.stderr ? error.stderr.toString() : null,
                status: error.status
            };
        }
    }
}

module.exports = AptosCliWrapper;