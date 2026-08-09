-- Shared roster validation: length 7, all elements >= 0.
CREATE OR REPLACE FUNCTION validate_roster(p_roster NUMERIC[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        p_roster IS NOT NULL
        AND array_length(p_roster, 1) = 7
        AND array_lower(p_roster, 1) = 1
        AND NOT EXISTS (
            SELECT 1 FROM unnest(p_roster) AS v(val) WHERE val IS NULL OR val < 0
        );
$$;

CREATE TABLE request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    person_id UUID REFERENCES person(id) ON DELETE SET NULL,
    billable_type billable_type NOT NULL,
    booking_type booking_type NOT NULL DEFAULT 'hard',
    probability SMALLINT NOT NULL DEFAULT 100 CHECK (probability BETWEEN 0 AND 100),
    status approval_status NOT NULL DEFAULT 'Pending',
    request_name TEXT,
    notes TEXT,
    consulting_unit_id UUID REFERENCES consulting_unit(id) ON DELETE SET NULL,
    practice_area_id UUID REFERENCES practice_area(id) ON DELETE SET NULL,
    competency_center_id UUID REFERENCES competency_center(id) ON DELETE SET NULL,
    site_id UUID REFERENCES site(id) ON DELETE SET NULL,
    job_level_id UUID REFERENCES job_level(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    unit schedule_unit NOT NULL DEFAULT 'utilization',
    roster NUMERIC(8, 4)[7] NOT NULL DEFAULT ARRAY[1, 1, 1, 1, 1, 0, 0]::NUMERIC(8, 4)[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT request_date_range CHECK (end_date >= start_date),
    CONSTRAINT request_roster_valid CHECK (validate_roster(roster))
);

CREATE TABLE schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    request_id UUID REFERENCES request(id) ON DELETE SET NULL,
    billable_type billable_type NOT NULL,
    booking_type booking_type NOT NULL DEFAULT 'hard',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    unit schedule_unit NOT NULL DEFAULT 'utilization',
    roster NUMERIC(8, 4)[7] NOT NULL DEFAULT ARRAY[1, 1, 1, 1, 1, 0, 0]::NUMERIC(8, 4)[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT schedule_date_range CHECK (end_date >= start_date),
    CONSTRAINT schedule_roster_valid CHECK (validate_roster(roster))
);

CREATE TABLE vacation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status approval_status NOT NULL DEFAULT 'Pending',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vacation_date_range CHECK (end_date >= start_date)
);

CREATE TABLE simulation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    record_count INT NOT NULL CHECK (record_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER request_set_updated_at
    BEFORE UPDATE ON request
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER schedule_set_updated_at
    BEFORE UPDATE ON schedule
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER vacation_set_updated_at
    BEFORE UPDATE ON vacation
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER simulation_log_set_updated_at
    BEFORE UPDATE ON simulation_log
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT ON request, schedule, vacation, simulation_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON request, schedule, vacation, simulation_log
    TO authenticated, service_role;
