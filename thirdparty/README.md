# Thirdparty: Postgres + PostgREST

Local data layer for Clairvoyance, adapted from the nocode reference stack (Postgres + PostgREST only).

## Services

| Service | Port | Description |
|---------|------|-------------|
| `clairvoyance-postgres` | 5433 | PostgreSQL 17 (host port; avoids conflict with local Postgres on 5432) |
| `clairvoyance-postgrest` | 4001 | PostgREST v12.2.3 (host port; avoids conflict with other local PostgREST instances) |

## Quick start

```bash
cd thirdparty
cp .env.postgres.example .env.postgres.dev
cp .env.postgrest.example .env.postgrest.dev
docker compose up -d
```

## Verify

```bash
# PostgREST OpenAPI root
curl http://localhost:4001/

# Postgres roles
psql postgres://api:helloapi@localhost:5433/clairvoyance -c '\du'

# Node API DB health (from repo root, with node/.env.dev configured)
curl http://localhost:4000/health/db
```

## Reset database

Init scripts run only on first volume creation. To re-run them:

```bash
docker compose down -v
docker compose up -d
```

## Credentials (dev)

| Variable | Value |
|----------|-------|
| Database | `clairvoyance` |
| Postgres superuser | `postgres` / `postgres_password` |
| API role (PostgREST + node) | `api` / `helloapi` |
| Service role | `service_role` / `helloservice` |

Node `DATABASE_URL`:

```
postgres://api:helloapi@localhost:5433/clairvoyance
```

## Database migrations (Flyway)

Single-tenant migrations target the **`public`** schema. See [`flyway/README.md`](flyway/README.md).

```bash
cd thirdparty/flyway
./migrate.sh dev    # Apply migrations
./info.sh dev       # Check status
```

After schema changes, restart PostgREST:

```bash
cd thirdparty && docker compose restart clairvoyance-postgrest
```

Requires the Docker stack (`docker compose up -d` from `thirdparty/`).
