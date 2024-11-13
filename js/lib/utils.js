module.exports = {
    // TODO: move out into helper?
    isIpAddress: function (str) {
        return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(str);
    },

    extractDomain: function (hostname) {
        try {
            // Prepend a protocol if not present to make the URL valid
            const urlString = hostname.includes('://') ? hostname : `http://${hostname}`;
            const myURL = new URL(urlString);

            // Extract the hostname first
            let fullHostname = myURL.hostname;

            // Split the hostname by dots
            let parts = fullHostname.split('.');

            // If we have more than two parts, return the last two joined
            if (parts.length > 2) {
                return parts.slice(-2).join('.');
            }

            // Otherwise, return the full hostname
            return fullHostname;
        } catch (error) {
            console.error('Error parsing hostname:', error.message);
            return null;
        }
    }
}