#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/load-flyway-config.sh" "${1:-dev}"

ENVIRONMENT="${1:-dev}"

echo "Running Flyway migrations (environment: $ENVIRONMENT, schema: public)"

docker run --rm \
    --name "flyway-migrate-$ENVIRONMENT" \
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
    -e FLYWAY_BASELINE_ON_MIGRATE=true \
    -e FLYWAY_BASELINE_VERSION=0 \
    -e FLYWAY_VALIDATE_ON_MIGRATE=true \
    "$FLYWAY_IMAGE" \
    migrate

echo "Migrations completed."

if docker ps --format '{{.Names}}' | grep -q '^clairvoyance-postgres$'; then
    echo "Reloading PostgREST schema cache..."
    docker exec clairvoyance-postgres psql -U postgres -d "$POSTGRES_DB" -c "NOTIFY pgrst, 'reload schema';" >/dev/null
fi
