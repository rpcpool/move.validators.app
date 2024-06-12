#!/bin/bash

# Source the password file if it exists
if [ -f .env_pass ]; then
  source .env_pass
else
  echo ".env_pass file not found!"
  exit 1
fi

# Set NODE_ENV to development if not set
if [ -z "$NODE_ENV" ]; then
  export NODE_ENV="development"
fi

# Determine the environment and load the appropriate .env file
case "$NODE_ENV" in
  "development")
    ENV_FILE=".env.development.enc"
    ;;
  "test")
    ENV_FILE=".env.test.enc"
    ;;
  "staging")
    ENV_FILE=".env.staging.enc"
    ;;
  "production")
    ENV_FILE=".env.production.enc"
    ;;
  *)
    echo "Unknown NODE_ENV: $NODE_ENV"
    exit 1
    ;;
esac

if [ -f $ENV_FILE ]; then
  # Decrypt the appropriate .env.enc file in memory
  pnpx dotenvenc -d -i $ENV_FILE $DOTENVENC_PASS

  # Export ENV_FILE so it can be used in other scripts
  export ENV_FILE
fi

# Run the command passed as arguments
exec "$@"
