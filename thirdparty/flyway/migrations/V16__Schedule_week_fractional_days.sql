-- Allow fractional schedule allocation days and increase schedule cap from 5 to 10.
-- This changes only schedule_week semantics; request_week remains 0..5.

ALTER TABLE schedule_week
    DROP CONSTRAINT IF EXISTS schedule_week_days_per_week_check;

ALTER TABLE schedule_week
    ALTER COLUMN days_per_week TYPE NUMERIC(4,2)
    USING days_per_week::NUMERIC(4,2);

ALTER TABLE schedule_week
    ADD CONSTRAINT schedule_week_days_per_week_check
    CHECK (days_per_week BETWEEN 0 AND 10);

-- Drop old 0..5 signature so PostgREST resolves to the numeric-capable variant.
DROP FUNCTION IF EXISTS upsert_schedule_range(
    UUID,
    UUID,
    DATE,
    DATE,
    SMALLINT,
    billable_type,
    booking_type,
    UUID
);

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
    v_days NUMERIC(4,2);
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
        v_days := (v_week->>'days_per_week')::NUMERIC(4,2);
        IF v_days < 0 OR v_days > 10 THEN
            RAISE EXCEPTION 'days_per_week must be between 0 and 10';
        END IF;

        INSERT INTO schedule_week (schedule_id, person_id, project_id, iso_year, iso_week, days_per_week)
        VALUES (
            p_schedule_id,
            v_person_id,
            v_project_id,
            (v_week->>'iso_year')::SMALLINT,
            (v_week->>'iso_week')::SMALLINT,
            v_days
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
    p_days_per_week NUMERIC(4,2),
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

    IF p_days_per_week < 0 OR p_days_per_week > 10 THEN
        RAISE EXCEPTION 'days_per_week must be between 0 and 10';
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

GRANT EXECUTE ON FUNCTION upsert_schedule_weeks(UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_schedule_range(UUID, UUID, DATE, DATE, NUMERIC, billable_type, booking_type, UUID)
    TO anon, authenticated, service_role;
