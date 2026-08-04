# Thirdparty: Clairvoyance Docker stack

Local stack for Clairvoyance: Postgres, PostgREST, Express API, and UI.

## Services

| Service | Port | Description |
|---------|------|-------------|
| `clairvoyance-postgres` | 5433 | PostgreSQL 17 (host port; avoids conflict with local Postgres on 5432) |
| `clairvoyance-postgrest` | 4001 | PostgREST v12.2.3 |
| `clairvoyance-api` | 4000 | Express API (`node/`) |
| `clairvoyance-ui` | 3000 | Vite/React UI served by nginx (`ui/`) |

## Quick start

```bash
cd thirdparty
cp .env.postgres.example .env.postgres.dev
cp .env.postgrest.example .env.postgrest.dev
cp .env.node.example .env.node.dev
cp .env.ui.example .env.ui.dev
docker compose up -d --build
```

Run Flyway migrations after Postgres is healthy (schema is required before the API/UI are useful):

```bash
cd thirdparty/flyway
./migrate.sh dev
```

## Verify

```bash
# PostgREST OpenAPI root
curl http://localhost:4001/

# Postgres roles
psql postgres://api:helloapi@localhost:5433/clairvoyance -c '\du'

# Node API health
curl http://localhost:4000/health
curl http://localhost:4000/health/db

# UI
open http://localhost:3000
```

To run only the data layer (Postgres + PostgREST):

```bash
docker compose up -d clairvoyance-postgres clairvoyance-postgrest
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
# Host (npm run dev)
postgres://api:helloapi@localhost:5433/clairvoyance

# Inside Docker (compose overrides this)
postgres://api:helloapi@clairvoyance-postgres:5432/clairvoyance
```

UI Vite URLs are baked at **image build** time and must use host ports the browser can reach (`http://localhost:4000` / `http://localhost:4001`). Override via `thirdparty/.env` or shell env before `docker compose build`.

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
