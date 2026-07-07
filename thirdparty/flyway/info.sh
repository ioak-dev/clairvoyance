#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-flyway-config.sh" "${1:-dev}"

ENVIRONMENT="${1:-dev}"

echo "Flyway migration status (environment: $ENVIRONMENT, schema: public)"

docker run --rm \
    --network "$NETWORK" \
    --platform "$FLYWAY_PLATFORM" \
    -v "$SCRIPT_DIR/migrations:/flyway/sql/migrations" \
    -e FLYWAY_URL=jdbc:postgresql://$POSTGRES_HOST:5432/$POSTGRES_DB \
    -e FLYWAY_USER="$API_USER" \
    -e FLYWAY_PASSWORD="$API_PASSWORD" \
    -e FLYWAY_SCHEMAS=public \
    -e FLYWAY_DEFAULT_SCHEMA=public \
    -e FLYWAY_TABLE=schema_version \
    -e FLYWAY_LOCATIONS=filesystem:sql/migrations \
    "$FLYWAY_IMAGE" \
    info
