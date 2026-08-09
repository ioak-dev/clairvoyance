CREATE TABLE schedule_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_id BIGINT NOT NULL DEFAULT txid_current(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('schedule')),
    change_action TEXT NOT NULL CHECK (change_action IN ('INSERT', 'UPDATE', 'DELETE')),
    schedule_id UUID,
    project_id UUID,
    person_id UUID,
    request_id UUID,
    title_before TEXT,
    title_after TEXT,
    start_date_before DATE,
    start_date_after DATE,
    end_date_before DATE,
    end_date_after DATE,
    unit_before schedule_unit,
    unit_after schedule_unit,
    roster_before NUMERIC(8, 4)[],
    roster_after NUMERIC(8, 4)[],
    billable_type_before billable_type,
    billable_type_after billable_type,
    booking_type_before booking_type,
    booking_type_after booking_type,
    old_row JSONB,
    new_row JSONB
);

CREATE INDEX idx_schedule_audit_log_project_changed_at
    ON schedule_audit_log(project_id, changed_at DESC);

CREATE INDEX idx_schedule_audit_log_person_changed_at
    ON schedule_audit_log(person_id, changed_at DESC);

CREATE INDEX idx_schedule_audit_log_schedule_changed_at
    ON schedule_audit_log(schedule_id, changed_at DESC);

CREATE OR REPLACE FUNCTION log_schedule_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO schedule_audit_log (
        entity_type,
        change_action,
        schedule_id,
        project_id,
        person_id,
        request_id,
        title_before,
        title_after,
        start_date_before,
        start_date_after,
        end_date_before,
        end_date_after,
        unit_before,
        unit_after,
        roster_before,
        roster_after,
        billable_type_before,
        billable_type_after,
        booking_type_before,
        booking_type_after,
        old_row,
        new_row
    ) VALUES (
        'schedule',
        TG_OP,
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.project_id, OLD.project_id),
        COALESCE(NEW.person_id, OLD.person_id),
        COALESCE(NEW.request_id, OLD.request_id),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.title ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.title ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.start_date ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.start_date ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.end_date ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.end_date ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.unit ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.unit ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.roster ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.roster ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.billable_type ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.billable_type ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.booking_type ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.booking_type ELSE NULL END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS schedule_audit_log_trigger ON schedule;
CREATE TRIGGER schedule_audit_log_trigger
    AFTER INSERT OR UPDATE OR DELETE ON schedule
    FOR EACH ROW EXECUTE FUNCTION log_schedule_audit_change();

CREATE OR REPLACE FUNCTION schedule_audit_report(
    p_project_ids UUID[] DEFAULT NULL,
    p_person_ids UUID[] DEFAULT NULL,
    p_changed_from DATE DEFAULT NULL,
    p_changed_to DATE DEFAULT NULL
)
RETURNS TABLE (
    audit_id UUID,
    changed_at TIMESTAMPTZ,
    transaction_id BIGINT,
    entity_type TEXT,
    change_action TEXT,
    schedule_id UUID,
    project_id UUID,
    project_reference_id TEXT,
    project_name TEXT,
    person_id UUID,
    person_employee_id TEXT,
    person_name TEXT,
    request_id UUID,
    request_reference_id TEXT,
    title_before TEXT,
    title_after TEXT,
    start_date_before DATE,
    start_date_after DATE,
    end_date_before DATE,
    end_date_after DATE,
    unit_before schedule_unit,
    unit_after schedule_unit,
    roster_before NUMERIC[],
    roster_after NUMERIC[],
    billable_type_before billable_type,
    billable_type_after billable_type,
    booking_type_before booking_type,
    booking_type_after booking_type,
    old_row JSONB,
    new_row JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_has_projects BOOLEAN := COALESCE(array_length(p_project_ids, 1), 0) > 0;
    v_has_people BOOLEAN := COALESCE(array_length(p_person_ids, 1), 0) > 0;
BEGIN
    IF v_has_projects = v_has_people THEN
        RAISE EXCEPTION 'Provide exactly one non-empty filter list: p_project_ids or p_person_ids';
    END IF;

    IF p_changed_from IS NOT NULL AND p_changed_to IS NOT NULL AND p_changed_to < p_changed_from THEN
        RAISE EXCEPTION 'p_changed_to must be on or after p_changed_from';
    END IF;

    RETURN QUERY
    SELECT
        sal.id AS audit_id,
        sal.changed_at,
        sal.transaction_id,
        sal.entity_type,
        sal.change_action,
        sal.schedule_id,
        sal.project_id,
        p.reference_id AS project_reference_id,
        p.name AS project_name,
        sal.person_id,
        pe.employee_id AS person_employee_id,
        NULLIF(TRIM(CONCAT(COALESCE(pe.first_name, ''), ' ', COALESCE(pe.last_name, ''))), '') AS person_name,
        sal.request_id,
        r.reference_id AS request_reference_id,
        sal.title_before,
        sal.title_after,
        sal.start_date_before,
        sal.start_date_after,
        sal.end_date_before,
        sal.end_date_after,
        sal.unit_before,
        sal.unit_after,
        sal.roster_before,
        sal.roster_after,
        sal.billable_type_before,
        sal.billable_type_after,
        sal.booking_type_before,
        sal.booking_type_after,
        sal.old_row,
        sal.new_row
    FROM schedule_audit_log sal
    LEFT JOIN project p ON p.id = sal.project_id
    LEFT JOIN person pe ON pe.id = sal.person_id
    LEFT JOIN request r ON r.id = sal.request_id
    WHERE (
        (v_has_projects AND sal.project_id = ANY (p_project_ids))
        OR (v_has_people AND sal.person_id = ANY (p_person_ids))
    )
      AND (p_changed_from IS NULL OR sal.changed_at >= p_changed_from::TIMESTAMPTZ)
      AND (p_changed_to IS NULL OR sal.changed_at < (p_changed_to + 1)::TIMESTAMPTZ)
    ORDER BY sal.changed_at DESC, sal.id DESC;
END;
$$;

GRANT SELECT ON schedule_audit_log TO anon;
GRANT SELECT ON schedule_audit_log TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION schedule_audit_report(UUID[], UUID[], DATE, DATE)
    TO anon, authenticated, service_role;
