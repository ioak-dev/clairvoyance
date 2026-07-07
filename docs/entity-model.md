# Clairvoyance Entity Model

Single-tenant data model for resource scheduling. All application tables live in the PostgreSQL **`public`** schema and are managed by Flyway migrations in [`thirdparty/flyway/migrations/`](../thirdparty/flyway/migrations/).

## Overview

| Type | Entities |
|------|----------|
| **Master lookup** | `market_unit`, `consulting_unit`, `practice_area`, `competency_center`, `site` |
| **Master** | `project`, `person`, `project_filter`, `person_filter`, `request_filter` |
| **Transactional** | `schedule`, `request`, `vacation` |

> **Note:** `ui/src/types/api.ts` still maps to the previous schema (colors, skills, etc.) and must be updated separately to align with this model.

## UI mapping

| Database entity | UI type (`ui/src/types.ts`) | Description |
|-----------------|----------------------------|-------------|
| `project` | `Project` | Project master catalog |
| `person` | `Resource` | People / resource master catalog |
| `schedule` | `Allocation` | Committed forecast / allocation blocks |
| `request` | `BookingRequest` | Pending booking requests |
| `vacation` | `Vacation` | Person absence blocks |
| `project_filter` | Dashboard / sidebar filters | Saved project selection criteria |
| `person_filter` | Dashboard / sidebar filters | Saved person selection criteria |
| `request_filter` | Dashboard / sidebar filters | Saved request selection criteria |

## Entity relationship diagram

```mermaid
erDiagram
    market_unit ||--o{ project : has
    consulting_unit ||--o{ project : has
    consulting_unit ||--o{ person : has
    practice_area ||--o{ person : has
    competency_center ||--o{ person : has
    site ||--o{ person : has
    person ||--o{ person : manages
    person ||--o{ project : manages
    project ||--o{ schedule : has
    person ||--o{ schedule : assigned_to
    project ||--o{ request : has
    person |o--o{ request : optional_assignee
    request |o--o{ schedule : optional_source
    person ||--o{ vacation : takes

    market_unit {
        uuid id PK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }

    consulting_unit {
        uuid id PK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }

    practice_area {
        uuid id PK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }

    competency_center {
        uuid id PK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }

    site {
        uuid id PK
        text name UK
        timestamptz created_at
        timestamptz updated_at
    }

    project {
        uuid id PK
        text project_id UK
        text name
        uuid manager_id FK
        uuid market_unit_id FK
        uuid consulting_unit_id FK
        numeric win_probability
        timestamptz created_at
        timestamptz updated_at
    }

    person {
        uuid id PK
        text employee_id UK
        text first_name
        text last_name
        text email UK
        date start_date
        text gender
        text status
        uuid consulting_unit_id FK
        uuid practice_area_id FK
        uuid competency_center_id FK
        text lifecycle_status
        uuid site_id FK
        uuid manager_id FK
        date termination_date
        text employment_type
        text job_category
        numeric fte
        numeric weekly_hours
        text global_designation
        text local_designation
        timestamptz created_at
        timestamptz updated_at
    }

    project_filter {
        uuid id PK
        text name
        text description
        jsonb criteria
        boolean is_active
        integer sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    person_filter {
        uuid id PK
        text name
        text description
        jsonb criteria
        boolean is_active
        integer sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    request {
        uuid id PK
        uuid project_id FK
        uuid person_id FK_nullable
        date start_date
        date end_date
        smallint billable_percent
        billable_type billable_type
        approval_status status
        text required_skill
        text notes
        timestamptz created_at
        timestamptz updated_at
    }

    schedule {
        uuid id PK
        uuid project_id FK
        uuid person_id FK
        uuid request_id FK_nullable
        date start_date
        date end_date
        smallint billable_percent
        billable_type billable_type
        timestamptz created_at
        timestamptz updated_at
    }

    vacation {
        uuid id PK
        uuid person_id FK
        date start_date
        date end_date
        approval_status status
        text reason
        timestamptz created_at
        timestamptz updated_at
    }
```

## Enumerations

### `billable_type`

Used by `request` and `schedule`.

| Value | UI equivalent |
|-------|---------------|
| `Billable` | `BillableType.Billable` |
| `Opportunity` | `BillableType.Opportunity` |

### `approval_status`

Used by `request` and `vacation`.

| Value | UI equivalent |
|-------|---------------|
| `Pending` | `'Pending'` |
| `Approved` | `'Approved'` |
| `Rejected` | `'Rejected'` |

## Check constraints

### `person.status`

| Value |
|-------|
| `Active` |
| `Inactive` |

### `person.lifecycle_status`

| Value |
|-------|
| `Hired` |
| `Employed` |
| `Terminated` |
| `Garden Leave` |
| `Leave` |
| `Parental Leave` |

### `person.job_category`

| Value |
|-------|
| `B0- Fresher` |
| `L0`, `L1`, `L2`, `L3`, `L4`, `L5` |
| `D0`, `D1`, `D2`, `D3`, `D4`, `D5` |

## Entities

### Master lookup tables

All lookup tables share the same shape: `id` (UUID PK), `name` (TEXT UNIQUE NOT NULL), `created_at`, `updated_at`.

| Table | Purpose |
|-------|---------|
| `market_unit` | Geographic / commercial market segment |
| `consulting_unit` | Consulting organization unit |
| `practice_area` | Practice area for people |
| `competency_center` | Competency center for people |
| `site` | Physical or virtual work site |

### `project` (master)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | Surrogate key |
| `project_id` | TEXT | UNIQUE, NOT NULL | Business identifier (e.g. `PRJ-TMS`) |
| `name` | TEXT | NOT NULL | Display name |
| `manager_id` | UUID | FK → `person.id`, nullable | Project manager |
| `market_unit_id` | UUID | FK → `market_unit.id`, nullable | |
| `consulting_unit_id` | UUID | FK → `consulting_unit.id`, nullable | |
| `win_probability` | NUMERIC(5,2) | 0–100 or null | 100 = committed; lower = opportunity |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated via trigger |

### `person` (master)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | Surrogate key |
| `employee_id` | TEXT | UNIQUE, NOT NULL | Business identifier (e.g. `EMP-1001`) |
| `first_name` | TEXT | NOT NULL | |
| `last_name` | TEXT | NOT NULL | |
| `email` | TEXT | UNIQUE, NOT NULL | |
| `start_date` | DATE | nullable | Employment start |
| `gender` | TEXT | nullable | |
| `status` | TEXT | NOT NULL, default `Active` | `Active` or `Inactive` |
| `consulting_unit_id` | UUID | FK → `consulting_unit.id`, nullable | |
| `practice_area_id` | UUID | FK → `practice_area.id`, nullable | |
| `competency_center_id` | UUID | FK → `competency_center.id`, nullable | |
| `lifecycle_status` | TEXT | NOT NULL, default `Employed` | See check constraint values |
| `site_id` | UUID | FK → `site.id`, nullable | |
| `manager_id` | UUID | FK → `person.id`, nullable | Self-referential manager |
| `termination_date` | DATE | nullable | |
| `employment_type` | TEXT | nullable | e.g. Full Time, Contractor |
| `job_category` | TEXT | nullable | See check constraint values |
| `fte` | NUMERIC(4,2) | nullable, ≥ 0 | Full-time equivalent |
| `weekly_hours` | NUMERIC(5,2) | nullable | |
| `global_designation` | TEXT | nullable | |
| `local_designation` | TEXT | nullable | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated via trigger |

### `project_filter` / `person_filter` / `request_filter` (master)

Saved filter definitions for narrowing project, person, or request lists in the UI.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `name` | TEXT | NOT NULL | Display name |
| `description` | TEXT | | Optional help text |
| `criteria` | JSONB | NOT NULL, default `{}` | Filter rules (see examples below) |
| `is_active` | BOOLEAN | NOT NULL, default `true` | |
| `sort_order` | INTEGER | NOT NULL, default `0` | Display ordering |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated via trigger |

**Example `project_filter.criteria`:**

```json
{
  "consulting_unit_id": "uuid-of-consulting-unit",
  "win_probability_lt": 100
}
```

**Example `person_filter.criteria`:**

```json
{
  "site_id": "uuid-of-site",
  "lifecycle_status": "Employed",
  "status": "Active"
}
```

**Example `request_filter.criteria`:**

```json
{
  "status": "Pending",
  "billable_type": "Billable",
  "unassigned_only": true,
  "project_consulting_unit_id": "uuid-of-consulting-unit"
}
```

### `request` (transactional)

Pending or approved booking requests for project staffing.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → `project.id`, NOT NULL | ON DELETE CASCADE |
| `person_id` | UUID | FK → `person.id`, nullable | Unassigned when null |
| `start_date` | DATE | NOT NULL | |
| `end_date` | DATE | NOT NULL | Must be ≥ `start_date` |
| `billable_percent` | SMALLINT | NOT NULL, 0–100 | Allocation percentage |
| `billable_type` | `billable_type` | NOT NULL | |
| `status` | `approval_status` | NOT NULL, default `Pending` | |
| `required_skill` | TEXT | | Skill matching hint for UI |
| `notes` | TEXT | | Request justification |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated via trigger |

### `schedule` (transactional)

Committed forecast / allocation blocks on the scheduler timeline.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → `project.id`, NOT NULL | ON DELETE CASCADE |
| `person_id` | UUID | FK → `person.id`, NOT NULL | ON DELETE CASCADE |
| `request_id` | UUID | FK → `request.id`, nullable | Links schedule back to originating request |
| `start_date` | DATE | NOT NULL | |
| `end_date` | DATE | NOT NULL | Must be ≥ `start_date` |
| `billable_percent` | SMALLINT | NOT NULL, 0–100 | |
| `billable_type` | `billable_type` | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated via trigger |

### `vacation` (transactional)

Person absence / vacation blocks.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `person_id` | UUID | FK → `person.id`, NOT NULL | ON DELETE CASCADE |
| `start_date` | DATE | NOT NULL | |
| `end_date` | DATE | NOT NULL | Must be ≥ `start_date` |
| `status` | `approval_status` | NOT NULL, default `Pending` | |
| `reason` | TEXT | | Optional description |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated via trigger |

## Relationships

| From | To | Cardinality | FK column | On delete |
|------|----|-------------|-----------|-----------|
| `project` | `person` | N : 0..1 | `manager_id` | SET NULL |
| `project` | `market_unit` | N : 0..1 | `market_unit_id` | SET NULL |
| `project` | `consulting_unit` | N : 0..1 | `consulting_unit_id` | SET NULL |
| `person` | `consulting_unit` | N : 0..1 | `consulting_unit_id` | SET NULL |
| `person` | `practice_area` | N : 0..1 | `practice_area_id` | SET NULL |
| `person` | `competency_center` | N : 0..1 | `competency_center_id` | SET NULL |
| `person` | `site` | N : 0..1 | `site_id` | SET NULL |
| `person` | `person` | N : 0..1 | `manager_id` | SET NULL |
| `schedule` | `project` | N : 1 | `project_id` | CASCADE |
| `schedule` | `person` | N : 1 | `person_id` | CASCADE |
| `schedule` | `request` | N : 0..1 | `request_id` | SET NULL |
| `request` | `project` | N : 1 | `project_id` | CASCADE |
| `request` | `person` | N : 0..1 | `person_id` | SET NULL |
| `vacation` | `person` | N : 1 | `person_id` | CASCADE |

`project_filter`, `person_filter`, and `request_filter` are standalone master tables with no foreign keys.

Read-only views expose dynamically computed match counts for the filter sidebar:

| View | Source table | `item_count` |
|------|--------------|--------------|
| `project_filter_with_count` | `project_filter` | Matching rows in `project` |
| `person_filter_with_count` | `person_filter` | Matching rows in `person` |
| `request_filter_with_count` | `request_filter` | Matching rows in `request` |

The UI lists filters from these views; create/update/delete still target the base tables.

## Lifecycle

```mermaid
flowchart LR
    requestPending[request status Pending]
    requestApproved[request status Approved]
    scheduleCommitted[schedule row created]
    requestPending -->|"assign person + approve"| requestApproved
    requestApproved -->|"optionally link request_id"| scheduleCommitted
```

1. A **request** is raised against a **project** (person may be unassigned).
2. When approved and staffed, a **schedule** row is created for the **person** on that **project**.
3. `schedule.request_id` optionally traces the schedule back to the originating request.
4. **Vacation** rows block a **person** on the timeline independently of project scheduling.

## Access

| Consumer | How | Example |
|----------|-----|---------|
| UI | PostgREST | `GET http://localhost:4001/project`, `GET http://localhost:4001/schedule?person_id=eq.{uuid}` |
| Node API | `pg` pool | `SELECT * FROM person WHERE employee_id = $1` |

Schema source of truth: Flyway migrations in [`thirdparty/flyway/migrations/`](../thirdparty/flyway/migrations/).

## Fresh database bootstrap

```bash
cd thirdparty
docker compose down -v
docker compose up -d
cd flyway && ./migrate.sh dev
```
