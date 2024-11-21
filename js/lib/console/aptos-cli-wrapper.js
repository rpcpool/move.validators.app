const {execSync} = require('child_process');
const {Network} = require("@aptos-labs/ts-sdk");

class AptosCliWrapper {
    constructor() {
        // Default local mode will find aptos in the path
        this.appName = 'aptos node';
        // If the cli path has been set, then we will use that.
        // NOTE: This is PATH ONLY, do not include executable
        if (process.env.APTOS_CLI_PATH !== undefined) {
            this.appName = `${process.env.APTOS_CLI_PATH}/aptos node`;
        }
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

            // console.log(" > Aptos CLI fullCommand:", fullCommand);

            // Execute the command
            let output = execSync(fullCommand, {
                encoding: 'utf-8',
                env: {...process.env},
                cwd: process.env.HOME,  // Set working directory if needed
                shell: true  // Use shell for command interpretation
            });

            // console.log(" > Aptos response:", output);

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