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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE request_week (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES request(id) ON DELETE CASCADE,
    iso_year SMALLINT NOT NULL,
    iso_week SMALLINT NOT NULL,
    days_per_week SMALLINT NOT NULL CHECK (days_per_week BETWEEN 0 AND 5),
    CONSTRAINT request_week_calendar_fk
        FOREIGN KEY (iso_year, iso_week) REFERENCES calendar_week(iso_year, iso_week),
    CONSTRAINT request_week_unique UNIQUE (request_id, iso_year, iso_week)
);

CREATE TABLE schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    request_id UUID REFERENCES request(id) ON DELETE SET NULL,
    billable_type billable_type NOT NULL,
    booking_type booking_type NOT NULL DEFAULT 'hard',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedule_week (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
    person_id UUID NOT NULL,
    project_id UUID NOT NULL,
    iso_year SMALLINT NOT NULL,
    iso_week SMALLINT NOT NULL,
    days_per_week SMALLINT NOT NULL CHECK (days_per_week BETWEEN 0 AND 5),
    CONSTRAINT schedule_week_calendar_fk
        FOREIGN KEY (iso_year, iso_week) REFERENCES calendar_week(iso_year, iso_week),
    CONSTRAINT schedule_week_unique UNIQUE (person_id, project_id, iso_year, iso_week)
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

GRANT SELECT ON request, request_week, schedule, schedule_week, vacation, simulation_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON request, request_week, schedule, schedule_week, vacation, simulation_log
    TO authenticated, service_role;
