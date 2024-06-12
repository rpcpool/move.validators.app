#!/bin/bash

# Source bootstrap.sh to setup the environment
source ./bin/bootstrap.sh

# Check if the .env.enc file exists
if [ -f $ENV_FILE ]; then
  # Decrypt the .env.enc file to .env
  pnpx dotenvenc -d -i $ENV_FILE -o .env $DOTENVENC_PASS
else
  # Create a new .env file if it does not exist
  touch .env
fi

# Open the .env file in the default editor
${EDITOR:-vi} .env

# Encrypt the .env file back to .env.enc
pnpx dotenvenc -e -i .env -o $ENV_FILE $DOTENVENC_PASS

# Remove the temporary .env file
rm .env
