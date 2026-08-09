CREATE TYPE billable_type AS ENUM ('Billable', 'Non-billable', 'Opportunity');
CREATE TYPE approval_status AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE booking_type AS ENUM ('hard', 'soft');

CREATE TABLE market_unit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consulting_unit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE practice_area (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE competency_center (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_area_id UUID NOT NULL REFERENCES practice_area(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT competency_center_practice_area_name_unique UNIQUE (practice_area_id, name)
);

CREATE TABLE site (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE job_level (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level_code TEXT NOT NULL UNIQUE,
    level_name TEXT NOT NULL,
    band TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE person (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    start_date DATE,
    gender TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    consulting_unit_id UUID REFERENCES consulting_unit(id) ON DELETE SET NULL,
    practice_area_id UUID REFERENCES practice_area(id) ON DELETE SET NULL,
    competency_center_id UUID REFERENCES competency_center(id) ON DELETE SET NULL,
    lifecycle_status TEXT NOT NULL DEFAULT 'Employed',
    site_id UUID REFERENCES site(id) ON DELETE SET NULL,
    job_level_id UUID REFERENCES job_level(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES person(id) ON DELETE SET NULL,
    termination_date DATE,
    employment_type TEXT,
    fte NUMERIC(4, 2),
    weekly_hours NUMERIC(5, 2),
    global_designation TEXT,
    local_designation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT person_status_check CHECK (status IN ('Active', 'Inactive')),
    CONSTRAINT person_lifecycle_status_check CHECK (
        lifecycle_status IN (
            'Hired', 'Employed', 'Terminated', 'Garden Leave', 'Leave', 'Parental Leave'
        )
    ),
    CONSTRAINT person_fte_check CHECK (fte IS NULL OR fte >= 0)
);

CREATE TABLE project (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    manager_id UUID REFERENCES person(id) ON DELETE SET NULL,
    market_unit_id UUID REFERENCES market_unit(id) ON DELETE SET NULL,
    consulting_unit_id UUID REFERENCES consulting_unit(id) ON DELETE SET NULL,
    win_probability NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT project_win_probability_check CHECK (
        win_probability IS NULL OR (win_probability >= 0 AND win_probability <= 100)
    )
);

CREATE TABLE project_filter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE person_filter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE request_filter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER market_unit_set_updated_at
    BEFORE UPDATE ON market_unit
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER consulting_unit_set_updated_at
    BEFORE UPDATE ON consulting_unit
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER practice_area_set_updated_at
    BEFORE UPDATE ON practice_area
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER competency_center_set_updated_at
    BEFORE UPDATE ON competency_center
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER site_set_updated_at
    BEFORE UPDATE ON site
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER job_level_set_updated_at
    BEFORE UPDATE ON job_level
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER person_set_updated_at
    BEFORE UPDATE ON person
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER project_set_updated_at
    BEFORE UPDATE ON project
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER project_filter_set_updated_at
    BEFORE UPDATE ON project_filter
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER person_filter_set_updated_at
    BEFORE UPDATE ON person_filter
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER request_filter_set_updated_at
    BEFORE UPDATE ON request_filter
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT ON
    market_unit, consulting_unit, practice_area, competency_center, site, job_level,
    person, project, project_filter, person_filter, request_filter
TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    market_unit, consulting_unit, practice_area, competency_center, site, job_level,
    person, project, project_filter, person_filter, request_filter
TO authenticated, service_role;

INSERT INTO request_filter (id, name, description, criteria, sort_order)
VALUES
  (
    (SELECT (
      substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 13, 3) ||
      '-a' || substr(h, 17, 3) || '-' || substr(h, 21, 12)
    )::uuid FROM (SELECT md5('clairvoyance:rf-all') AS h) s),
    'All Requests', 'No request filter applied', '{}'::jsonb, 0
  ),
  (
    (SELECT (
      substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 13, 3) ||
      '-a' || substr(h, 17, 3) || '-' || substr(h, 21, 12)
    )::uuid FROM (SELECT md5('clairvoyance:rf-pending') AS h) s),
    'Pending Only', 'Requests awaiting assignment', '{"status": "Pending"}'::jsonb, 1
  ),
  (
    (SELECT (
      substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 13, 3) ||
      '-a' || substr(h, 17, 3) || '-' || substr(h, 21, 12)
    )::uuid FROM (SELECT md5('clairvoyance:rf-unassigned') AS h) s),
    'Unassigned', 'Requests without an assigned person', '{"unassigned_only": true}'::jsonb, 2
  )
ON CONFLICT (id) DO NOTHING;
