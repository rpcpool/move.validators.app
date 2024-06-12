const {createClient} = require("redis");
const path = require('path');
const dotenvenc = require('@tka85/dotenvenc');
const ValidatorsList = require("../daemons/validators-list");
const EpochHistory = require("../daemons/epoch-history");

/**
 * This class will bootstrap all/any of the daemons we want to run in development mode only. It is not meant to
 * be used in any other environment. It should be excluded from any deployable builds as well.
 * In the start() method, encrypted env vars are decrypted and add to the process.env, redis is bootstrapped and then
 * each daemon is started.
 */
class DevDaemons {
  constructor() {
    this.daemons = [];
  }

  async start() {
    // Load in the secure env vars
    const env = process.env.NODE_ENV || 'development';
    const encryptedFilePath = path.resolve(process.cwd(), `.env.${env}.enc`);

    try {
      await dotenvenc.decrypt({ encryptedFile: encryptedFilePath });
      console.log('Environment variables decrypted successfully.');

      // Init redis
      const redisUrl = process.env.REDIS_URL;
      const redisClient = createClient({ url: redisUrl });
      await redisClient.connect();

      // Set up each daemon here for management
      // Each daemon is run via a local systemd service, so they need to be able to start themselves based on
      // instantiation.
      // Below we define the ones we want to run locally.

      // ValidatorsList
      const validatorsList = new ValidatorsList(redisClient);
      await validatorsList.start();
      this.daemons.push(validatorsList);

      // EpochHistory
      const epochHistory = new EpochHistory(redisClient);
      await epochHistory.start();
      this.daemons.push(epochHistory);

    } catch (err) {
      console.error('Failed to decrypt environment variables:', err);
      process.exit(1);
    }
  }

  // Currently we don't have a need to stop the daemons, but we add that stub here.
  async stop() {
    for (let daemon of this.daemons) {
      if (daemon) await daemon.stop();
    }
  }
}

new DevDaemons().start().then();

module.exports = DevDaemons;
