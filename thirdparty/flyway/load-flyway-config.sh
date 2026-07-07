#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENVIRONMENT="${1:-dev}"

if [ "$ENVIRONMENT" = "dev" ]; then
    CONFIG_FILE="$SCRIPT_DIR/flyway.dev.conf"
else
    CONFIG_FILE="$SCRIPT_DIR/flyway.conf"
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Flyway config file not found: $CONFIG_FILE"
    exit 1
fi

export FLYWAY_URL=$(grep "^flyway.url=" "$CONFIG_FILE" | cut -d'=' -f2)
export FLYWAY_USER=$(grep "^flyway.user=" "$CONFIG_FILE" | cut -d'=' -f2)
export FLYWAY_PASSWORD=$(grep "^flyway.password=" "$CONFIG_FILE" | cut -d'=' -f2)

URL_PART=$(echo "$FLYWAY_URL" | sed 's|jdbc:postgresql://||')
export POSTGRES_HOST=$(echo "$URL_PART" | cut -d':' -f1)
export POSTGRES_DB=$(echo "$URL_PART" | cut -d'/' -f2)

export NETWORK="clairvoyance-network"
export API_USER="$FLYWAY_USER"
export API_PASSWORD="$FLYWAY_PASSWORD"
export POSTGRES_USER="postgres"
export POSTGRES_PASSWORD="postgres_password"
export FLYWAY_IMAGE="flyway/flyway:10-alpine"
export FLYWAY_PLATFORM="linux/amd64"

export FLYWAY_DEV_CONFIG="$SCRIPT_DIR/flyway.dev.conf"
export FLYWAY_PROD_CONFIG="$SCRIPT_DIR/flyway.conf"
