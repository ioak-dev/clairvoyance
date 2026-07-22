CREATE TABLE request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id TEXT NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    person_id UUID REFERENCES person(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    billable_percent SMALLINT NOT NULL CHECK (billable_percent BETWEEN 0 AND 100),
    billable_type billable_type NOT NULL,
    booking_type booking_type NOT NULL DEFAULT 'hard',
    probability SMALLINT NOT NULL DEFAULT 100 CHECK (probability BETWEEN 0 AND 100),
    status approval_status NOT NULL DEFAULT 'Pending',
    required_skill TEXT,
    notes TEXT,
    consulting_unit_id UUID REFERENCES consulting_unit(id) ON DELETE SET NULL,
    practice_area_id UUID REFERENCES practice_area(id) ON DELETE SET NULL,
    competency_center_id UUID REFERENCES competency_center(id) ON DELETE SET NULL,
    site_id UUID REFERENCES site(id) ON DELETE SET NULL,
    job_category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT request_date_range CHECK (end_date >= start_date),
    CONSTRAINT request_job_category_check CHECK (
        job_category IS NULL OR job_category IN (
            'B0- Fresher',
            'L0', 'L1', 'L2', 'L3', 'L4', 'L5',
            'D0', 'D1', 'D2', 'D3', 'D4', 'D5'
        )
    )
);

CREATE TABLE schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    request_id UUID REFERENCES request(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    billable_percent SMALLINT NOT NULL CHECK (billable_percent BETWEEN 0 AND 100),
    billable_type billable_type NOT NULL,
    booking_type booking_type NOT NULL DEFAULT 'hard',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT schedule_date_range CHECK (end_date >= start_date)
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

CREATE TRIGGER request_set_updated_at
    BEFORE UPDATE ON request
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER schedule_set_updated_at
    BEFORE UPDATE ON schedule
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER vacation_set_updated_at
    BEFORE UPDATE ON vacation
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT ON request, schedule, vacation TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON request, schedule, vacation TO authenticated, service_role;
