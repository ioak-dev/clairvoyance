-- Allow schedule/request billable_type to be an optional override.
-- NULL means inherit from project.billable_type.

ALTER TABLE request
    ALTER COLUMN billable_type DROP NOT NULL;

ALTER TABLE schedule
    ALTER COLUMN billable_type DROP NOT NULL;

-- upsert_schedule: stop defaulting missing billable_type to 'Billable'.
CREATE OR REPLACE FUNCTION upsert_schedule(
    p_payload JSONB
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
    v_person_id UUID;
    v_project_id UUID;
    v_request_id UUID;
    v_start DATE;
    v_end DATE;
    v_unit schedule_unit;
    v_roster NUMERIC(8, 4)[];
    v_title TEXT;
    v_billable billable_type;
    v_booking booking_type;
BEGIN
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'payload must be a JSON object';
    END IF;

    v_id := NULLIF(p_payload->>'id', '')::UUID;
    v_person_id := COALESCE(
        NULLIF(p_payload->>'person_id', '')::UUID,
        NULLIF(p_payload->>'resourceId', '')::UUID
    );
    v_project_id := COALESCE(
        NULLIF(p_payload->>'project_id', '')::UUID,
        NULLIF(p_payload->>'projectId', '')::UUID
    );
    v_request_id := COALESCE(
        NULLIF(p_payload->>'request_id', '')::UUID,
        NULLIF(p_payload->>'requestId', '')::UUID
    );

    IF v_person_id IS NULL OR v_project_id IS NULL THEN
        RAISE EXCEPTION 'person_id/resourceId and project_id/projectId are required';
    END IF;

    v_start := COALESCE(
        NULLIF(p_payload->>'start', '')::DATE,
        NULLIF(p_payload->>'start_date', '')::DATE
    );
    v_end := COALESCE(
        NULLIF(p_payload->>'end', '')::DATE,
        NULLIF(p_payload->>'end_date', '')::DATE
    );
    IF v_start IS NULL OR v_end IS NULL THEN
        RAISE EXCEPTION 'start and end dates are required';
    END IF;
    IF v_end < v_start THEN
        RAISE EXCEPTION 'end must be on or after start';
    END IF;

    PERFORM assert_schedule_no_person_project_overlap(
        v_person_id, v_project_id, v_start, v_end, v_id
    );

    v_unit := COALESCE((p_payload->>'unit')::schedule_unit, 'utilization');
    v_roster := parse_roster_json(COALESCE(p_payload->'roster', '[1,1,1,1,1,0,0]'::jsonb));
    v_title := NULLIF(trim(COALESCE(p_payload->>'title', '')), '');
    -- Optional override: omit/null → NULL (inherit project.billable_type at read time).
    v_billable := COALESCE(
        (p_payload->>'billable_type')::billable_type,
        (p_payload->>'billableType')::billable_type
    );
    v_booking := COALESCE(
        (p_payload->>'booking_type')::booking_type,
        (p_payload->>'bookingType')::booking_type,
        'hard'::booking_type
    );

    IF v_id IS NOT NULL THEN
        UPDATE schedule SET
            title = v_title,
            person_id = v_person_id,
            project_id = v_project_id,
            request_id = v_request_id,
            billable_type = v_billable,
            booking_type = v_booking,
            start_date = v_start,
            end_date = v_end,
            unit = v_unit,
            roster = v_roster,
            updated_at = NOW()
        WHERE id = v_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'schedule not found: %', v_id;
        END IF;

        RETURN v_id;
    END IF;

    INSERT INTO schedule (
        title, person_id, project_id, request_id,
        billable_type, booking_type,
        start_date, end_date, unit, roster
    ) VALUES (
        v_title, v_person_id, v_project_id, v_request_id,
        v_billable, v_booking,
        v_start, v_end, v_unit, v_roster
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- Filter on effective billable type: request override ?? project.
CREATE OR REPLACE FUNCTION request_matches_filter_criteria(
    p_request request,
    p_criteria JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT
        p_criteria IS NULL
        OR p_criteria = '{}'::jsonb
        OR (
            (NOT p_criteria ? 'status' OR p_request.status::text = p_criteria->>'status')
            AND (
                NOT p_criteria ? 'billable_type'
                OR COALESCE(
                    p_request.billable_type::text,
                    (SELECT p.billable_type::text FROM project p WHERE p.id = p_request.project_id)
                ) = p_criteria->>'billable_type'
            )
            AND (
                NOT p_criteria ? 'unassigned_only'
                OR COALESCE((p_criteria->>'unassigned_only')::boolean, false) = false
                OR p_request.person_id IS NULL
            )
            AND (
                NOT p_criteria ? 'project_consulting_unit_id'
                OR EXISTS (
                    SELECT 1 FROM project p
                    WHERE p.id = p_request.project_id
                      AND p.consulting_unit_id::text = p_criteria->>'project_consulting_unit_id'
                )
            )
        );
$$;
