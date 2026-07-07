CREATE TABLE request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    person_id UUID REFERENCES person(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    billable_percent SMALLINT NOT NULL CHECK (billable_percent BETWEEN 0 AND 100),
    billable_type billable_type NOT NULL,
    status approval_status NOT NULL DEFAULT 'Pending',
    required_skill TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT request_date_range CHECK (end_date >= start_date)
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
