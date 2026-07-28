CREATE OR REPLACE FUNCTION copy_request_to_schedule(
    p_request_id UUID,
    p_person_id UUID
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_schedule_id UUID;
    v_project_id UUID;
    v_billable_type billable_type;
    v_booking_type booking_type;
BEGIN
    SELECT r.project_id, r.billable_type, r.booking_type
    INTO v_project_id, v_billable_type, v_booking_type
    FROM request r
    WHERE r.id = p_request_id;

    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'request not found: %', p_request_id;
    END IF;

    DELETE FROM schedule WHERE request_id = p_request_id;

    INSERT INTO schedule (project_id, person_id, request_id, billable_type, booking_type)
    VALUES (v_project_id, p_person_id, p_request_id, v_billable_type, v_booking_type)
    RETURNING id INTO v_schedule_id;

    INSERT INTO schedule_week (schedule_id, person_id, project_id, iso_year, iso_week, days_per_week)
    SELECT v_schedule_id, p_person_id, v_project_id, rw.iso_year, rw.iso_week, rw.days_per_week
    FROM request_week rw
    WHERE rw.request_id = p_request_id
    ON CONFLICT (person_id, project_id, iso_year, iso_week)
    DO UPDATE SET
        schedule_id = EXCLUDED.schedule_id,
        days_per_week = EXCLUDED.days_per_week;

    UPDATE request
    SET person_id = p_person_id, status = 'Approved', updated_at = NOW()
    WHERE id = p_request_id;

    RETURN v_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_schedule_weeks(
    p_schedule_id UUID,
    p_weeks JSONB
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_week JSONB;
    v_person_id UUID;
    v_project_id UUID;
    v_count INT := 0;
BEGIN
    SELECT person_id, project_id INTO v_person_id, v_project_id
    FROM schedule WHERE id = p_schedule_id;

    IF v_person_id IS NULL THEN
        RAISE EXCEPTION 'schedule not found: %', p_schedule_id;
    END IF;

    IF p_weeks IS NULL OR jsonb_typeof(p_weeks) <> 'array' THEN
        RAISE EXCEPTION 'weeks must be a JSON array';
    END IF;

    FOR v_week IN SELECT value FROM jsonb_array_elements(p_weeks)
    LOOP
        INSERT INTO schedule_week (schedule_id, person_id, project_id, iso_year, iso_week, days_per_week)
        VALUES (
            p_schedule_id,
            v_person_id,
            v_project_id,
            (v_week->>'iso_year')::SMALLINT,
            (v_week->>'iso_week')::SMALLINT,
            (v_week->>'days_per_week')::SMALLINT
        )
        ON CONFLICT (person_id, project_id, iso_year, iso_week)
        DO UPDATE SET
            schedule_id = EXCLUDED.schedule_id,
            days_per_week = EXCLUDED.days_per_week;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_schedule_range(
    p_person_id UUID,
    p_project_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_days_per_week SMALLINT,
    p_billable_type billable_type DEFAULT 'Billable',
    p_booking_type booking_type DEFAULT 'hard',
    p_request_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_schedule_id UUID;
    v_week RECORD;
BEGIN
    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'end_date must be >= start_date';
    END IF;

    IF p_days_per_week < 0 OR p_days_per_week > 5 THEN
        RAISE EXCEPTION 'days_per_week must be between 0 and 5';
    END IF;

    SELECT id INTO v_schedule_id
    FROM schedule
    WHERE person_id = p_person_id
      AND project_id = p_project_id
      AND (
          (p_request_id IS NULL AND request_id IS NULL)
          OR request_id = p_request_id
      )
    LIMIT 1;

    IF v_schedule_id IS NULL THEN
        INSERT INTO schedule (person_id, project_id, request_id, billable_type, booking_type)
        VALUES (p_person_id, p_project_id, p_request_id, p_billable_type, p_booking_type)
        RETURNING id INTO v_schedule_id;
    ELSE
        UPDATE schedule
        SET billable_type = p_billable_type,
            booking_type = p_booking_type,
            updated_at = NOW()
        WHERE id = v_schedule_id;
    END IF;

    FOR v_week IN
        SELECT cw.iso_year, cw.iso_week
        FROM calendar_week cw
        WHERE cw.week_start <= p_end_date
          AND cw.week_end >= p_start_date
        ORDER BY cw.iso_year, cw.iso_week
    LOOP
        INSERT INTO schedule_week (schedule_id, person_id, project_id, iso_year, iso_week, days_per_week)
        VALUES (v_schedule_id, p_person_id, p_project_id, v_week.iso_year, v_week.iso_week, p_days_per_week)
        ON CONFLICT (person_id, project_id, iso_year, iso_week)
        DO UPDATE SET
            schedule_id = EXCLUDED.schedule_id,
            days_per_week = EXCLUDED.days_per_week;
    END LOOP;

    RETURN v_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_schedule_weeks_in_range(
    p_schedule_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM schedule_week sw
    USING calendar_week cw
    WHERE sw.schedule_id = p_schedule_id
      AND sw.iso_year = cw.iso_year
      AND sw.iso_week = cw.iso_week
      AND cw.week_start <= p_end_date
      AND cw.week_end >= p_start_date;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    DELETE FROM schedule s
    WHERE s.id = p_schedule_id
      AND NOT EXISTS (SELECT 1 FROM schedule_week sw WHERE sw.schedule_id = s.id);

    RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION copy_request_to_schedule(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_schedule_weeks(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_schedule_range(UUID, UUID, DATE, DATE, SMALLINT, billable_type, booking_type, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_schedule_weeks_in_range(UUID, DATE, DATE) TO anon, authenticated, service_role;
