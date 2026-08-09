# Flyway Migrations

Single-tenant schema migrations for Clairvoyance. All application tables live in the **`public`** schema. Migrations run via Docker (no local Flyway install required).

## Prerequisites

```bash
cd thirdparty
docker compose up -d
```

## Architecture

| Layer | Managed by |
|-------|------------|
| Roles, auth helpers (`auth`, `api` schemas) | `thirdparty/sql/init/` (first DB boot only) |
| Application tables (`project`, `person`, `schedule`, `request`, etc.) | Flyway `migrations/` in **`public`** |

## Commands

Run from `thirdparty/flyway/`:

```bash
./migrate.sh dev    # Apply pending migrations
./info.sh dev       # Show migration status
```

After DDL changes while PostgREST is running, `migrate.sh` sends `NOTIFY pgrst, 'reload schema'`. If permissions still look stale, restart PostgREST:

```bash
cd ../.. && cd thirdparty && docker compose restart clairvoyance-postgrest
```

## Migration naming

```
migrations/V<version>__<Description>.sql
```

## Configuration

| File | Purpose |
|------|---------|
| `flyway.dev.conf` | Dev JDBC URL and credentials |
| `flyway.conf` | Prod |
| `load-flyway-config.sh` | Shared config loader |

| Setting | Value |
|---------|-------|
| Host | `clairvoyance-postgres` |
| Database | `clairvoyance` |
| Schema | `public` |
| Flyway user | `api` / `helloapi` |

Host Postgres port: **5433** (see `thirdparty/README.md`).

## Access

| Consumer | Endpoint |
|----------|----------|
| UI (PostgREST) | `http://localhost:4001/project`, `/person`, `/schedule`, `/request`, etc. |
| Node (`pg`) | `DATABASE_URL` → same tables in `public` |

## Reset database

Init scripts and Flyway history reset together:

```bash
cd thirdparty
docker compose down -v
docker compose up -d
cd flyway && ./migrate.sh dev
```
