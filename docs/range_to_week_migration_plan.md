# Range → Week-Based Scheduling Migration Plan

> **Status:** Design locked — ready for phased implementation  
> **Last updated:** 2026-07-28  
> **Goal:** Replace date-range allocation (`start_date` / `end_date`) with per-week rows (`iso_year`, `iso_week`) and **days-per-week utilization**, while preserving a range-friendly UI and aligning with upstream week-array contracts.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Design Principles](#2-design-principles)
3. [Current State (As-Is)](#3-current-state-as-is)
4. [Target State (To-Be)](#4-target-state-to-be)
5. [Week Definition](#5-week-definition)
6. [Entity Model](#6-entity-model)
7. [Derived Blocks — UI Presentation Layer](#7-derived-blocks--ui-presentation-layer)
8. [User Interaction Flows](#8-user-interaction-flows)
9. [Request → Schedule Lifecycle](#9-request--schedule-lifecycle)
10. [API & Service Layer](#10-api--service-layer)
11. [SQL Functions & Analytics](#11-sql-functions--analytics)
12. [Lab / Upstream Integration](#12-lab--upstream-integration)
13. [Clean-Slate Strategy (Flyway + Application)](#13-clean-slate-strategy-flyway--application)
14. [Impact Matrix](#14-impact-matrix)
15. [Locked Design Decisions](#15-locked-design-decisions)
16. [Allocation Metric — Days Per Week](#16-allocation-metric--days-per-week)
17. [Phased Implementation Plan](#17-phased-implementation-plan)
18. [Risks & Mitigations](#18-risks--mitigations)

---

## 1. Problem Statement

Today, scheduling allocates a person to a project using a **single date range** per row (`start_date`, `end_date`). This model:

- Cannot represent **different days-per-week per ISO week** within one assignment.
- Encourages **multiple overlapping rows** for the same person/project (see seed data).
- Makes partial edits (change 3 weeks inside a 12-week block) require row splits/merges — logic that doesn't exist today.
- Couples **request** and **schedule** to the same flat date-range shape, so copying on approval is a shallow field copy.

The new model stores **one row per week per assignment**, keyed by `(iso_year, iso_week)`. The UI still lets users pick date ranges, but every operation **materializes to individual week rows**. Visual continuity is a **derived presentation**, not a stored grouping.

---

## 2. Design Principles

| # | Principle | Rationale |
|---|-----------|-----------|
| P1 | **Week rows are the source of truth** | No persisted "block" or "range set" entity. Blocks are computed at read/render time. |
| P2 | **Same shape for request and schedule weeks** | Request week rows copy verbatim to schedule week rows on assignment — simple, auditable. |
| P3 | **Range UX, week storage** | Users think in date ranges; the system converts ranges → week list on write. |
| P4 | **Partial edits are splits, not exceptions** | Editing a sub-range within a block creates new week values for those weeks only; adjacent weeks unchanged. |
| P5 | **One canonical week calendar** | ISO 8601 everywhere (Monday week start). No mixed Mon/Sun conventions. |
| P6 | **Header + detail tables** | `request` and `schedule` become headers (metadata); week allocations live in child tables. One schedule header **per assignment**. |
| P7 | **Fail closed on ambiguity** | Overlapping week rows for the same `(person, project, year, week)` are forbidden at DB level. |
| P8 | **Days per week, not percent** | Allocation amount is `days_per_week` (0–5) per week row. Replaces `billable_percent`. |
| P9 | **Over-allocation across projects allowed** | A person may exceed 5 total days/week across projects; cap applies per assignment only. |
| P10 | **Upstream week arrays only** | Lab/upstream sends header + `weeks[]` numbers — no date-range adapter. |
| P11 | **Clean slate, no legacy** | Rewrite Flyway from scratch; fresh DB every rebuild; no shims or backward-compat code. |

---

## 3. Current State (Prior Iteration — To Be Replaced)

> The codebase and Flyway scripts below describe the **date-range model being discarded**. Section [§13](#13-clean-slate-strategy-flyway--application) replaces all of this from scratch.

### Database

| Table | Date fields | Notes |
|-------|-------------|-------|
| `request` | `start_date`, `end_date` | Flat row; `billable_percent` at row level |
| `schedule` | `start_date`, `end_date` | Flat row; optional `request_id` link |
| `vacation` | `start_date`, `end_date` | **Out of scope** — stays date-range (see §15) |

### Relationships

```
project ──< request (project_id)
project ──< schedule (project_id)
person  ──< schedule (person_id)
person  ──o< request (person_id, nullable)
request ──o< schedule (request_id)
```

### UI

- `SchedulerGrid`: day-column Gantt (52px/day), blocks positioned by `startDate`/`endDate`.
- Modals (`ScheduleModal`, `EditAllocationModal`, `RequestModal`): native `<input type="date">`.
- Overlap fetch: `start_date.lte.{end} AND end_date.gte.{start}`.

### Week logic today

- **None in DB.** UI-only helpers (`getWeekKey`, dashboard bucketing) with **inconsistent** week boundaries (Monday vs Sunday).

### Key files

- Schema: `thirdparty/flyway/migrations/V3__*.sql`, `V9__*.sql`, `V11__*.sql`
- Types: `ui/src/types.ts`, `ui/src/types/api.ts`
- Services: `ui/src/lib/services/schedules.ts`, `requests.ts`
- UI: `ui/src/components/SchedulerGrid.tsx`, `Modals.tsx`
- Docs: `docs/entity-model.md`

---

## 4. Target State (To-Be)

### Conceptual shift

```
BEFORE:  schedule row = { person, project, start_date, end_date, billable_percent, ... }
AFTER:   schedule header = { person, project, request_id?, billable_type, booking_type, ... }
         schedule_week[] = { iso_year, iso_week, days_per_week }   -- scheduling numbers only
```

Same for `request` → `request_week`.

### What users see vs what is stored

| User sees | Stored as |
|-----------|-----------|
| One green block spanning Jun 2 – Aug 15 at 4 days/wk | 11 individual `schedule_week` rows (W23–W33), each `days_per_week = 4` |
| Same block, but edits Jul 7–Jul 18 to 2 days/wk | W28–W30 updated to 2; other weeks stay 4 → UI shows **3 blocks** |
| Request with mixed weeks (4, 4, 2, 2 days) | 4 `request_week` rows; on approve, 4 `schedule_week` rows copied |

**No "block" table. No "range set" table.** Blocks = consecutive weeks with identical `days_per_week` (header fields like `billable_type` are constant per assignment).

---

## 5. Week Definition

### **Locked:** ISO 8601 week date (Monday start)

| Field | Type | Meaning |
|-------|------|---------|
| `iso_year` | SMALLINT | ISO week-numbering year (may differ from calendar year at year boundaries) |
| `iso_week` | SMALLINT | ISO week number, 1–53 |

- Week starts **Monday**, ends **Sunday**. This matches upstream systems.
- Use PostgreSQL `EXTRACT(WEEK FROM date)` is **not** ISO — we need explicit ISO functions.

### Canonical calendar support table (recommended)

```sql
CREATE TABLE calendar_week (
    iso_year   SMALLINT NOT NULL,
    iso_week   SMALLINT NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
    week_start DATE NOT NULL,  -- Monday
    week_end   DATE NOT NULL,  -- Sunday
    PRIMARY KEY (iso_year, iso_week),
    UNIQUE (week_start)
);
```

Pre-populated for planning horizon (e.g. 2020–2035). Benefits:

- Fast joins instead of runtime date math.
- Single source of truth for week boundaries.
- Resolves ISO year boundary edge cases once.

### Date range → week list conversion

When UI sends `{ startDate, endDate }`:

```
weeks = all calendar_week rows WHERE week_start <= endDate AND week_end >= startDate
```

**Partial weeks at boundaries are included** if any day of that ISO week overlaps the selected range. This matches user expectation when picking calendar dates.

### UI shared library

Replace mixed helpers with one module: `ui/src/lib/weekUtils.ts`

- `dateRangeToWeeks(start, end): WeekKey[]`
- `weekToDateRange(year, week): { start, end }`
- `weekKeysToDateRange(weeks): { start, end }` — for block display
- `groupConsecutiveWeeks(weekRows, compareFields): AllocationBlock[]`

---

## 6. Entity Model

### 6.1 New / modified tables

```mermaid
erDiagram
    request ||--o{ request_week : has
    schedule ||--o{ schedule_week : has
    request |o--o{ schedule : "spawns"
    calendar_week ||--o{ request_week : "defines boundary"
    calendar_week ||--o{ schedule_week : "defines boundary"

    request {
        uuid id PK
        text reference_id UK
        uuid project_id FK
        uuid person_id FK_nullable
        billable_type billable_type
        booking_type booking_type
        smallint probability
        approval_status status
        text required_skill
        text notes
        uuid consulting_unit_id FK
        uuid practice_area_id FK
        uuid competency_center_id FK
        uuid site_id FK
        text job_category
        timestamptz created_at
        timestamptz updated_at
    }

    request_week {
        uuid id PK
        uuid request_id FK
        smallint iso_year
        smallint iso_week
        smallint days_per_week
    }

    schedule {
        uuid id PK
        uuid project_id FK
        uuid person_id FK
        uuid request_id FK_nullable
        billable_type billable_type
        booking_type booking_type
        timestamptz created_at
        timestamptz updated_at
    }

    schedule_week {
        uuid id PK
        uuid schedule_id FK
        uuid person_id FK
        uuid project_id FK
        smallint iso_year
        smallint iso_week
        smallint days_per_week
    }
```

### 6.2 Header vs week row responsibilities (locked — matches upstream)

| Layer | Fields | Purpose |
|-------|--------|---------|
| **Header** (`request`, `schedule`) | `project_id`, `person_id`, `reference_id`, `status`, staffing criteria, `billable_type`, `booking_type`, `probability`, … | Metadata and classification — **constant for the assignment** |
| **Week row** (`request_week`, `schedule_week`) | `iso_year`, `iso_week`, `days_per_week` | **Scheduling numbers only** — no type/commitment fields |

Headers never store `start_date`, `end_date`, or `billable_percent`.

**Optional derived views (display only, not stored):**

```sql
CREATE VIEW request_with_bounds AS
SELECT r.*,
       MIN(cw.week_start) AS start_date,
       MAX(cw.week_end)   AS end_date
FROM request r
JOIN request_week rw ON rw.request_id = r.id
JOIN calendar_week cw ON cw.iso_year = rw.iso_year AND cw.iso_week = rw.iso_week
GROUP BY r.id;
```

Same pattern for `schedule_with_bounds`.

### 6.3 Constraints

```sql
-- One allocation per request per week
UNIQUE (request_id, iso_year, iso_week) ON request_week

-- One allocation per person+project per week (prevents double-booking)
UNIQUE (person_id, project_id, iso_year, iso_week) ON schedule_week
  -- via join to schedule header, or denormalize person_id/project_id onto schedule_week
```

**Denormalization option:** Add `person_id`, `project_id` directly on `schedule_week` for simpler overlap queries and unique constraint, kept in sync via trigger or application logic. **Recommend denormalizing** — overlap checks are hot path.

```sql
CREATE TABLE schedule_week (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
    person_id       UUID NOT NULL,  -- denormalized from schedule
    project_id      UUID NOT NULL,  -- denormalized from schedule
    iso_year        SMALLINT NOT NULL,
    iso_week        SMALLINT NOT NULL,
    days_per_week   SMALLINT NOT NULL CHECK (days_per_week BETWEEN 0 AND 5),
    UNIQUE (person_id, project_id, iso_year, iso_week)
);

CREATE TABLE request_week (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID NOT NULL REFERENCES request(id) ON DELETE CASCADE,
    iso_year        SMALLINT NOT NULL,
    iso_week        SMALLINT NOT NULL,
    days_per_week   SMALLINT NOT NULL CHECK (days_per_week BETWEEN 0 AND 5),
    UNIQUE (request_id, iso_year, iso_week)
);
```

**Schedule header semantics (locked):** One `schedule` header per **assignment** (a distinct staffing action — from a request approval or a direct manual allocation). A person may have multiple schedule headers for the same project if they were assigned at different times; week rows are unique on `(person_id, project_id, iso_year, iso_week)` regardless of header.

### 6.4 Indexes

```sql
CREATE INDEX idx_request_week_request ON request_week(request_id);
CREATE INDEX idx_request_week_year_week ON request_week(iso_year, iso_week);
CREATE INDEX idx_schedule_week_person ON schedule_week(person_id, iso_year, iso_week);
CREATE INDEX idx_schedule_week_project ON schedule_week(project_id, iso_year, iso_week);
CREATE INDEX idx_schedule_week_range ON schedule_week(iso_year, iso_week);
```

---

## 7. Derived Blocks — UI Presentation Layer

### Block derivation algorithm

For a given lane (e.g. person × project):

```
Input:  week rows sorted by (iso_year, iso_week)
Output: AllocationBlock[]

AllocationBlock = {
  startDate: string,      // week_start of first week in run
  endDate: string,        // week_end of last week in run
  weeks: WeekKey[],       // underlying week keys
  daysPerWeek: number,    // 0–5
  billableType: BillableType,
  bookingType: BookingCommitmentType,
  scheduleId: string,     // header id
  requestId?: string,
}
```

**Grouping rule:** Consecutive weeks (no gap in ISO week sequence) with identical `days_per_week` form one block. `billable_type` / `booking_type` come from the header (constant for the assignment).

**Gap handling (locked):** If W30 is missing (no row), W29 and W31 do **not** merge — the gap breaks continuity. Missing weeks are not implicit 0; only explicit rows exist.

### Timeline rendering change

| Aspect | Current | Target |
|--------|---------|--------|
| Column unit | Day (52px) | Week (~28–40px) |
| Block width | `(endDate - startDate + 1) × 52px` | `weekCount × weekColumnWidth` |
| Scroll window | ±28 days | ±8 weeks |
| Header | Month + day numbers | Month + "W23" labels |

Week columns align with storage granularity — no sub-week positioning needed.

### Why not store blocks?

| Stored blocks | Stored weeks + derived blocks |
|---------------|-------------------------------|
| Split/merge logic on every partial edit | UPDATE only affected week rows |
| Block/range table sync drift | Single source of truth |
| Extra entity to migrate | Reuses natural week key |
| "Apply to subset" needs exception rows | Native — just update those weeks |

---

## 8. User Interaction Flows

### 8.1 Create allocation (date range → weeks)

1. User opens `ScheduleModal`, picks person, project, **start date**, **end date**, **days per week** (0–5).
2. Client calls `dateRangeToWeeks(start, end)` → `[W23, W24, …, W30]`.
3. Client POSTs:
   ```json
   {
     "project_id": "...",
     "person_id": "...",
     "weeks": [
       { "iso_year": 2026, "iso_week": 23, "days_per_week": 4 }
       ...
     ]
   }
   ```
4. Server: create `schedule` header (one per assignment) + bulk insert `schedule_week` rows.
5. Grid re-fetches, derives blocks → one continuous block shown.

### 8.2 Edit entire block (click block)

1. User clicks block covering W23–W30 at 4 days/wk.
2. Modal opens pre-filled:
   - **Apply to range:** Jun 2 – Aug 3 (derived from weeks)
   - **Days per week:** 4
3. User changes to 5 days/wk, keeps same range.
4. Client PATCHes all week rows W23–W30 → `days_per_week: 5`.
5. Block stays one block (same weeks, new days value).

### 8.3 Partial edit within a longer block ⭐ (locked UX)

1. User clicks block W23–W30 at 4 days/wk.
2. Modal shows:
   - **Block extent** (read-only context): Jun 2 – Aug 3
   - **Apply changes to** (editable sub-range): defaults to full block, user narrows to Jul 7 – Jul 18
   - **Days per week:** 2
3. Client converts sub-range → W28, W29, W30.
4. Client PATCHes only those 3 week rows.
5. Grid re-derives:
   - Block 1: W23–W27 @ 4 days/wk
   - Block 2: W28–W30 @ 2 days/wk

**Modal UX sketch:**

```
┌─────────────────────────────────────────────┐
│ Edit Allocation                              │
│                                              │
│ Project: TMS    Person: Jane Smith           │
│                                              │
│ Block span:  Jun 2, 2026 – Aug 3, 2026     │
│              (11 weeks)                      │
│                                              │
│ Apply changes to:                            │
│   Start [2026-07-07]  End [2026-07-18]      │
│   ☐ Use full block span                      │
│                                              │
│ Days / week: [2]  (0–5)                      │
│ Type:        [Billable ▾]                    │
│ Commitment:  [hard ▾]                        │
│                                              │
│              [Cancel]  [Save]                │
└─────────────────────────────────────────────┘
```

The "Use full block span" checkbox resets apply range to block extent.

### 8.4 Extend allocation (add weeks)

User picks a range that extends beyond current block:

- Range W23–W35, existing W23–W30 @ 4 days/wk.
- W31–W35 are new weeks → INSERT with same allocation fields.
- W23–W30 → UPDATE if fields changed, else no-op.

Implement as **upsert weeks in range** (single API operation).

### 8.5 Delete allocation (locked)

- Block click → delete all weeks in that block (header deleted if no weeks remain).
- Modal supports partial delete via sub-range (same "Apply changes to" control).

### 8.6 Create / edit request

Same flows as schedule, but writes to `request_week`. Request grid shows derived blocks identically.

### 8.7 Drag to resize (future enhancement)

Drag block edge → compute new week range → upsert/delete week rows at boundary. Not required for MVP but week model makes this tractable.

---

## 9. Request → Schedule Lifecycle

### Current flow (App.tsx)

```
approve request → delete schedules by request_id → create schedule (copy dates) → update request status
```

### New flow

```
approve request with person
  → create schedule header (project_id, person_id, request_id,
                            billable_type, booking_type from request header)
  → INSERT INTO schedule_week (schedule_id, person_id, project_id,
                               iso_year, iso_week, days_per_week)
      SELECT schedule.id, :person_id, request.project_id,
             rw.iso_year, rw.iso_week, rw.days_per_week
      FROM request_week rw
      WHERE rw.request_id = :request_id
  → update request (status=Approved, person_id)
```

**Week numbers copied verbatim.** Header metadata copied once. No date-range logic.

### Re-publish from Lab (upsert by reference_id)

Current: `publish_lab_requests` upserts request dates, deletes linked schedules.

New:

1. Upsert `request` header (no dates).
2. Delete all `request_week` for that request.
3. Insert new `request_week` rows from payload (see §12).
4. If request was Approved and had schedule: delete `schedule_week` via schedule header, re-copy from new request weeks.

### Re-assign person on approved request

1. Delete existing `schedule` header (+ cascade `schedule_week`).
2. Create new schedule for new person.
3. Copy `request_week` → `schedule_week`.
4. Update `request.person_id`.

---

## 10. API & Service Layer

### 10.1 PostgREST access patterns

**Reads — join weeks to headers:**

```
GET /schedule?select=*,schedule_week(*)&person_id=eq.{id}
GET /schedule_week?iso_year=gte.2026&iso_year=lte.2027&person_id=eq.{id}
```

For range overlap fetch (replaces date overlap):

```
GET /schedule_week?and=(iso_year.gte.{y1},iso_year.lte.{y2})
  &person_id=eq.{id}
```

Refine in SQL with RPC for precise week-range overlap if needed.

**Writes — prefer RPC for atomic multi-row ops:**

| RPC | Purpose |
|-----|---------|
| `upsert_schedule_weeks(p_schedule_id, p_weeks jsonb)` | Create/update weeks in bulk |
| `upsert_schedule_range(p_person_id, p_project_id, p_start_date, p_end_date, p_allocation jsonb)` | Header + weeks in one call |
| `delete_schedule_weeks_in_range(p_schedule_id, p_start_date, p_end_date)` | Partial delete |
| `copy_request_to_schedule(p_request_id, p_person_id)` | Approval flow |
| `derive_schedule_blocks(p_person_id, p_from, p_to)` | Optional server-side block grouping |

Direct PostgREST PATCH on individual `schedule_week` rows works for simple edits but lacks atomicity for range ops.

### 10.2 UI types (target)

```typescript
interface WeekKey {
  isoYear: number;
  isoWeek: number;
}

interface WeekAllocation {
  isoYear: number;
  isoWeek: number;
  daysPerWeek: number;   // 0–5 — only scheduling field on week row
}

interface ScheduleHeader {
  id: string;
  resourceId: string;
  projectId: string;
  requestId?: string;
  billableType: BillableType;    // header-level
  bookingType: BookingCommitmentType;  // header-level
}

interface AllocationBlock {
  scheduleId: string;
  startDate: string;   // derived from week range via calendar_week
  endDate: string;
  weeks: WeekKey[];
  daysPerWeek: number;
  billableType: BillableType;    // from header
  bookingType: BookingCommitmentType;
  requestId?: string;
}
```

`Allocation` (current) maps to `AllocationBlock` for display; underlying data is `ScheduleHeader + WeekAllocation[]`.

### 10.3 React Query keys

```
['schedules', 'weeks', personId, yearStart, yearEnd]
['requests', 'weeks', requestId]
['allocation-blocks', personId, viewStart, viewEnd]  // client-derived, optional cache
```

---

## 11. SQL Functions & Analytics

### Functions requiring rewrite

| Function | File | Change |
|----------|------|--------|
| `person_period_utilization(p_person_id, p_from, p_to)` | V9 | Sum `days_per_week` per ISO week across all assignments; convert to segments |
| `person_utilization_search(...)` | V9, V10, V13 | Replace `p_required_percent` with `p_required_days`; filter/average on days |
| `publish_lab_requests(...)` | V11 | Parse week-array payload → insert `request_week` rows |

See [§16](#16-allocation-metric--days-per-week) for the full utilization model.

### Dashboard metrics

`ui/src/lib/dashboardMetrics.ts` — replace percent-based hour math with days-based:

```
planned_hours_in_week = days_per_week × (weekly_hours / 5) × fte   // per assignment
person_total_days_in_week = SUM(days_per_week) across all assignments  // may exceed 5
```

Align week boundaries to ISO via `weekUtils.ts`. Remove Sunday/Monday inconsistency.

---

## 12. Lab / Upstream Integration

### **Locked:** Week arrays only — header metadata + week numbers

Upstream shape: **header-level details**, **week-level scheduling numbers only**. This app matches upstream exactly. No date-range fields, no per-week type fields, no adapter layer.

### Payload contract

```json
{
  "id": "REQ-001",
  "project_id": "...",
  "required_skill": "...",
  "billable_type": "Billable",
  "booking_type": "hard",
  "probability": 100,
  "status": "Pending",
  "consulting_unit_id": "...",
  "weeks": [
    { "iso_year": 2026, "iso_week": 23, "days_per_week": 4 },
    { "iso_year": 2026, "iso_week": 24, "days_per_week": 2 }
  ]
}
```

### Field placement (locked)

| Location | Fields |
|----------|--------|
| **Payload header** | `id`, `project_id`, `person_id`, `billable_type`, `booking_type`, `probability`, `status`, `required_skill`, `notes`, org FKs, `job_category` |
| **Each `weeks[]` entry** | `iso_year`, `iso_week`, `days_per_week` **only** |

**Rules:**

- `weeks` array is **required**. Reject payloads missing it or containing `start_date`/`end_date`/`billable_percent`.
- `days_per_week` must be 0–5 on every week entry.
- Upsert by `reference_id`: replace header fields + delete/reinsert all `request_week` rows.
- On publish update of an approved request: refresh linked `schedule_week` rows from new `request_week` data.

### DB insert mapping

```
request         ← payload header fields
request_week    ← payload.weeks[] (iso_year, iso_week, days_per_week)
```

No denormalization of header fields onto week rows.

### Lab UI

- `LabEditModal` / `labEditFieldConfig.ts`: header fields + week-array editor; **no** date or percent fields.
- `toLabRequestPayloadItem`: `{ ...header, weeks: [{ iso_year, iso_week, days_per_week }] }`.

---

## 13. Clean-Slate Strategy (Flyway + Application)

### **Locked:** Replace all migrations from scratch — no incremental evolution

This is MVP. Every rebuild runs on a **fresh database**. The existing V1–V13 Flyway scripts (date-range model, percent utilization, incremental RPC revisions) are **discarded and rewritten** — not extended.

**Explicitly out of scope:**

- Incremental migrations (V14, V15, …) layered on old schema
- Data backfill from `start_date`/`end_date` or `billable_percent`
- Percent → days conversion scripts
- Dual-read / dual-write transition periods
- Compatibility views exposing old column shapes
- UI/API shims, deprecated types, or "legacy" code paths
- `Allocation.startDate`/`endDate`/`billablePercent` retained "for now"

Every rebuild should leave **no trace** of the prior date-range iteration.

### 13.1 Flyway: delete and rewrite

Remove all files in `thirdparty/flyway/migrations/` and replace with a clean set targeting the week model from day one:

| New file | Contents |
|----------|----------|
| `V1__Create_utility_functions.sql` | `set_updated_at()` trigger function |
| `V2__Create_enums_and_master_tables.sql` | Enums, lookups, `person`, `project`, filters |
| `V3__Create_calendar_week.sql` | `calendar_week` table + ISO week seed (2020–2035) |
| `V4__Create_transactional_tables.sql` | `request` + `request_week`, `schedule` + `schedule_week`, `vacation`, `simulation_log` — **week model only** |
| `V5__Create_indexes.sql` | Week indexes, FK indexes |
| `V6__Create_filter_views.sql` | Filter count views (unchanged purpose) |
| `V7__Person_utilization.sql` | `person_period_utilization`, `person_utilization_search` — **days-based, single final version** |
| `V8__Lab_publish.sql` | `publish_lab_requests` (week-array payload), `publish_lab_projects` |
| `V9__Schedule_rpcs.sql` | `upsert_schedule_weeks`, `copy_request_to_schedule`, range helpers |
| `V10__Grants.sql` | PostgREST role grants |
| `V11__Seed_dev_data.sql` | Dev seed using week arrays — no date-range rows |

No V10/V13-style "patch previous function" files. Each RPC appears once in its final form.

### 13.2 Bootstrap procedure

```bash
cd thirdparty
docker compose down -v          # destroy old volume
docker compose up -d
cd flyway && ./migrate.sh dev   # apply clean V1–V11
```

### 13.3 Application code: same clean-slate rule

| Area | Action |
|------|--------|
| `ui/src/types.ts` | Remove `Allocation` date-range shape; use `ScheduleHeader`, `WeekAllocation`, `AllocationBlock` |
| `ui/src/types/api.ts` | Remove `ScheduleRow.start_date`, `billable_percent` mappers; week-row mappers only |
| `ui/src/lib/services/schedules.ts` | Remove date overlap queries; week-range fetch only |
| `ui/src/components/SchedulerGrid.tsx` | Week columns only — no day-column code path |
| `ui/src/components/Modals.tsx` | Days/week + sub-range UX — no percent or date-range allocation fields |
| `ui/src/data.ts` | Rewrite mock data as week arrays or delete if unused |
| `ui/src/lib/dashboardMetrics.ts` | Days-based math only |
| `docs/entity-model.md` | Rewrite to match new schema |

**No `@deprecated` markers.** Delete old code; don't wrap it.

### 13.4 What stays date-range

`vacation` keeps `start_date`/`end_date` — different domain, unchanged.

---

## 14. Impact Matrix

| Layer | File / Component | Action |
|-------|------------------|--------|
| **DB** | All `thirdparty/flyway/migrations/V*.sql` | **Delete and rewrite** V1–V11 (see §13.1) |
| **Docs** | `docs/entity-model.md` | Full rewrite |
| **UI types** | `ui/src/types.ts`, `ui/src/types/api.ts` | Week model only; delete date-range types |
| **UI lib** | `dateUtils.ts`, new `weekUtils.ts`, `dashboardMetrics.ts` | ISO weeks + days-based metrics |
| **UI svc** | `schedules.ts`, `requests.ts` | Week fetch/RPC only |
| **UI hooks** | `useSchedules.ts`, `useRequests.ts` | Week query keys |
| **UI** | `SchedulerGrid.tsx`, `Modals.tsx` | Week columns + sub-range UX |
| **UI** | `SkillMatcherModal.tsx`, `App.tsx` | Days-based utilization |
| **UI** | `LabTab.tsx`, `LabEditModal.tsx`, `labEditFieldConfig.ts` | Header + week-array editor |
| **UI** | `ui/src/data.ts` | Rewrite or delete mock date-range data |
| **Node** | `node/src/routes/lab.ts` | Pass-through (no change expected) |
| **Unchanged** | `vacation` | Date-range stays |

---

## 15. Locked Design Decisions

| # | Decision | Resolution |
|---|----------|------------|
| D1 | Week standard | **ISO 8601**, Monday start |
| D2 | Missing week rows | **Gap breaks block** — explicit rows only, no implicit 0 |
| D3 | Denormalize person/project on week rows | **Yes** |
| D4 | Vacation | **Stays date-range** — out of scope |
| D5 | Lab / upstream contract | **Week arrays only** — no date-range adapter; align app to upstream |
| D6 | Delete semantics | Block delete + partial delete via sub-range in modal |
| D7 | Schedule header | **One header per assignment** |
| D8 | Cross-project overlap | **Allowed** — person may exceed 5 total days/week across projects |
| D9 | Allocation metric | **`days_per_week` (0–5)** replaces `billable_percent` |
| D10 | Per-assignment cap | Max **5 days/week** per `(person, project, iso_year, iso_week)` |
| D11 | Partial edit UX | **"Apply changes to" sub-range** within block (§8.3) |
| D12 | Upstream field placement | **Header = metadata; week row = `iso_year`, `iso_week`, `days_per_week` only** |
| D13 | Flyway / codebase strategy | **Rewrite from scratch** — fresh DB, no incremental migrations, no legacy shims (§13) |

---

## 16. Allocation Metric — Days Per Week

### Overview

Utilization is expressed as **working days per ISO week**, not percentage.

| Scope | Field | Range | Constraint |
|-------|-------|-------|------------|
| Single week row (`request_week` / `schedule_week`) | `days_per_week` | 0–5 | Max 5 per row |
| Person × project × week | sum of rows for that pair | 0–5 | UNIQUE constraint — at most one row |
| Person × week (all projects) | sum across assignments | 0–∞ | **Over-allocation allowed** (may exceed 5) |

### Examples

| Jane's week W25 | Project A | Project B | Total days | Over-allocated? |
|-----------------|-----------|-----------|------------|-----------------|
| Scenario 1 | 4 days | 3 days | 7 | Yes (allowed) |
| Scenario 2 | 5 days | — | 5 | No |
| Scenario 3 | 3 days | 2 days | 5 | No |

Scenario 1 is valid: each assignment row respects the 5-day cap; the person is over-allocated in aggregate.

### Block display

Blocks show **days per week** in label/tooltip, e.g. `"TMS · 4d/wk"`. Optional visual encoding: block opacity or fill density proportional to days/5 within the assignment (not across projects).

### Skill Matcher / availability search

Replace `p_required_percent` (0–100) with **`p_required_days`** (0–5):

| Mode | Current logic | New logic |
|------|---------------|-----------|
| Complete availability | `avg_availability >= required_percent` | `avg_available_days >= required_days` |
| Partial availability | `avg_availability >= 0.75 × required_percent` | `avg_available_days >= 0.75 × required_days` |

**Per-week availability:**

```
allocated_days = SUM(schedule_week.days_per_week)
  WHERE person_id = X AND iso_year/week = W

available_days = 5 - allocated_days   // may be negative if over-allocated
```

`person_period_utilization` returns segments of consecutive weeks with the same total allocated days (and optionally availability).

### Hours conversion (dashboard KPIs)

When displaying hours for reporting:

```
hours_per_week = days_per_week × (person.weekly_hours / 5) × person.fte
```

This replaces the old `billable_percent / 100 × weekday_count × daily_hours` formula.

### DB constraint summary

```sql
CHECK (days_per_week BETWEEN 0 AND 5)  -- on request_week and schedule_week
-- No CHECK on person-level weekly sum; over-allocation is a valid business state
```

### UI validation

- Schedule/request modals: days input clamped 0–5, integer only.
- Optional warning (not blocking): if saving would push person's total days in any affected week above 5, show "Over-allocated in W25 (7/5 days)" — informational, save still allowed.

---

## 17. Phased Implementation Plan

### Phase 0 — Design sign-off

- [x] Resolve design decisions (§15)
- [x] Upstream header/week field split (D12)
- [x] Clean-slate Flyway strategy (D13)
- [ ] Stakeholder review

### Phase 1 — Database (clean Flyway rewrite)

- [ ] Delete existing V1–V13 migrations
- [ ] Write V1–V11 per §13.1 (week model from day one)
- [ ] Seed dev data with week arrays
- [ ] Verify fresh bootstrap: `docker compose down -v && migrate`

### Phase 2 — Shared libraries

- [ ] `weekUtils.ts` (ISO week math, block derivation, date-range → weeks for UI input)
- [ ] Update `ui/src/types.ts`, `ui/src/types/api.ts` — week model only
- [ ] RPC-backed services: `schedules.ts`, `requests.ts`

### Phase 3 — UI core

- [ ] Week-column `SchedulerGrid` + derived blocks
- [ ] `ScheduleModal` / `EditAllocationModal` with sub-range UX (days/week)
- [ ] Request approval flow (`copy_request_to_schedule`)
- [ ] Delete all date-range scheduling code paths

### Phase 4 — Analytics & Lab

- [ ] Days-based utilization RPCs consumed by Skill Matcher + dashboard
- [ ] Lab tab: header + week-array editor matching upstream payload
- [ ] Rewrite `docs/entity-model.md`

### Phase 5 — Verification

- [ ] End-to-end: Lab publish → request weeks → approve → schedule weeks → grid blocks
- [ ] Over-allocation scenario (person > 5 days/week across projects)
- [ ] Partial edit within block (sub-range split)
- [ ] No remaining references to `start_date`/`end_date`/`billable_percent` on request/schedule (grep check)

---

## 18. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ISO week year boundaries confuse users (W1 in Dec) | Wrong week selected | Show "Mon DD – Sun DD" under W label; tooltip with ISO year |
| Large range → many rows (52 weeks/year) | POST payload size | Bulk RPC, batch inserts; 1 year ≈ 52 rows — acceptable |
| Performance: fetching weeks vs ranges | Slower grid load | Index `(person_id, iso_year, iso_week)`; fetch only visible window |
| Partial edit UX complexity | User confusion | Clear "Apply changes to" sub-range with block context |
| Over-allocation not visible to user | Bad staffing decisions | Informational warning when person total days > 5 in any week |
| Legacy code accidentally retained | Confusion, bugs | Phase 5 grep check; no `@deprecated` — delete instead |

---

## Appendix A — Example scenario walkthrough

**Setup:** Jane on project TMS, user creates allocation Jun 2 – Aug 3, 2026 at 4 days/wk.

**Stored (11 rows):**

| iso_year | iso_week | days_per_week |
|----------|----------|---------------|
| 2026 | 23 | 4 |
| 2026 | 24 | 4 |
| … | … | 4 |
| 2026 | 33 | 4 |

**UI:** 1 block labeled "4d/wk".

**Action:** User edits Jul 7 – Jul 18 to 2 days/wk.

**Stored after edit:**

| iso_year | iso_week | days_per_week |
|----------|----------|---------------|
| 2026 | 23–27 | 4 |
| 2026 | 28–30 | 2 |
| 2026 | 31–33 | 4 |

**UI:** 3 blocks. No block entity was created or deleted — only week rows changed.

**Action:** Manager approves request that has the same week shape.

**Result:** `schedule_week` rows copy `request_week` numbers; schedule header copies request header metadata (`billable_type`, `booking_type`); `schedule.request_id` links back.

---

## Appendix B — Alternatives considered

### B1: Store date ranges + week override exceptions

```
schedule_range { start, end, percent }
schedule_week_override { year, week, percent }  -- sparse exceptions
```

Rejected: asymmetric read/write paths; override/range interaction is fragile; hard to reason about copies from request.

### B2: JSONB week map on header

```
schedule.weeks = { "2026-W23": 80, "2026-W24": 80, ... }
```

Rejected: no FK integrity, hard to index, awkward overlap queries, poor PostgREST ergonomics.

### B3: Persisted block/group entity

Rejected per user requirement ("do we group weeks into a set? no").

---

## Revision Log

| Date | Author | Change |
|------|--------|--------|
| 2026-07-28 | — | Initial draft from codebase analysis |
| 2026-07-28 | — | Locked upstream header/week split; clean-slate Flyway rewrite (no incremental migrations, no legacy shims) |
