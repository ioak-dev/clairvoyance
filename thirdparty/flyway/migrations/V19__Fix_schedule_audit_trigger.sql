CREATE OR REPLACE FUNCTION log_schedule_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_row JSONB;
    v_new_row JSONB;
    v_schedule_id UUID;
    v_schedule_week_id UUID;
    v_project_id UUID;
    v_person_id UUID;
    v_request_id UUID;
    v_iso_year SMALLINT;
    v_iso_week SMALLINT;
    v_days_before NUMERIC(4,2);
    v_days_after NUMERIC(4,2);
    v_billable_before billable_type;
    v_billable_after billable_type;
    v_booking_before booking_type;
    v_booking_after booking_type;
BEGIN
    v_old_row := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
    v_new_row := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;

    IF TG_TABLE_NAME = 'schedule' THEN
        v_schedule_id := COALESCE(NEW.id, OLD.id);
        v_project_id := COALESCE(NEW.project_id, OLD.project_id);
        v_person_id := COALESCE(NEW.person_id, OLD.person_id);
        v_request_id := COALESCE(NEW.request_id, OLD.request_id);
        v_billable_before := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.billable_type ELSE NULL END;
        v_billable_after := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.billable_type ELSE NULL END;
        v_booking_before := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.booking_type ELSE NULL END;
        v_booking_after := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.booking_type ELSE NULL END;
    ELSIF TG_TABLE_NAME = 'schedule_week' THEN
        v_schedule_id := COALESCE(NEW.schedule_id, OLD.schedule_id);
        v_schedule_week_id := COALESCE(NEW.id, OLD.id);
        v_project_id := COALESCE(NEW.project_id, OLD.project_id);
        v_person_id := COALESCE(NEW.person_id, OLD.person_id);
        v_iso_year := COALESCE(NEW.iso_year, OLD.iso_year);
        v_iso_week := COALESCE(NEW.iso_week, OLD.iso_week);
        v_days_before := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.days_per_week ELSE NULL END;
        v_days_after := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.days_per_week ELSE NULL END;

        SELECT s.request_id, s.billable_type, s.booking_type
        INTO v_request_id, v_billable_before, v_booking_before
        FROM schedule s
        WHERE s.id = v_schedule_id;

        IF TG_OP = 'INSERT' THEN
            v_billable_before := NULL;
            v_booking_before := NULL;
        END IF;

        IF TG_OP = 'DELETE' THEN
            v_billable_after := NULL;
            v_booking_after := NULL;
        ELSE
            v_billable_after := v_billable_before;
            v_booking_after := v_booking_before;
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported schedule audit table: %', TG_TABLE_NAME;
    END IF;

    INSERT INTO schedule_audit_log (
        entity_type,
        change_action,
        schedule_id,
        schedule_week_id,
        project_id,
        person_id,
        request_id,
        iso_year,
        iso_week,
        days_per_week_before,
        days_per_week_after,
        billable_type_before,
        billable_type_after,
        booking_type_before,
        booking_type_after,
        old_row,
        new_row
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        v_schedule_id,
        v_schedule_week_id,
        v_project_id,
        v_person_id,
        v_request_id,
        v_iso_year,
        v_iso_week,
        v_days_before,
        v_days_after,
        v_billable_before,
        v_billable_after,
        v_booking_before,
        v_booking_after,
        v_old_row,
        v_new_row
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;