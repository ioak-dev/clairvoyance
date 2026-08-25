-- Allow overlapping schedules for the same person + project (stacked lanes in UI).
-- Add move_schedule RPC for drag-and-drop (entire booking or carved sub-range).

DROP TRIGGER IF EXISTS schedule_no_person_project_overlap ON schedule;
DROP FUNCTION IF EXISTS prevent_schedule_person_project_overlap();

-- Keep the symbol for any external callers; enforcement removed.
CREATE OR REPLACE FUNCTION assert_schedule_no_person_project_overlap(
    p_person_id UUID,
    p_project_id UUID,
    p_start DATE,
    p_end DATE,
    p_exclude_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    -- No-op: same person + project date overlaps are allowed.
    RETURN;
END;
$$;

-- upsert_schedule without overlap assert (V14 billable override semantics).
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

    v_unit := COALESCE((p_payload->>'unit')::schedule_unit, 'utilization');
    v_roster := parse_roster_json(COALESCE(p_payload->'roster', '[1,1,1,1,1,0,0]'::jsonb));
    v_title := NULLIF(trim(COALESCE(p_payload->>'title', '')), '');
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

-- copy_request_to_schedule without overlap assert.
CREATE OR REPLACE FUNCTION copy_request_to_schedule(
    p_request_id UUID,
    p_person_id UUID
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_req request%ROWTYPE;
    v_schedule_id UUID;
BEGIN
    SELECT * INTO v_req FROM request WHERE id = p_request_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'request not found: %', p_request_id;
    END IF;

    IF p_person_id IS NULL THEN
        RAISE EXCEPTION 'p_person_id is required';
    END IF;

    DELETE FROM schedule WHERE request_id = p_request_id;

    INSERT INTO schedule (
        title, person_id, project_id, request_id,
        billable_type, booking_type,
        start_date, end_date, unit, roster
    ) VALUES (
        v_req.request_name,
        p_person_id,
        v_req.project_id,
        v_req.id,
        v_req.billable_type,
        v_req.booking_type,
        v_req.start_date,
        v_req.end_date,
        v_req.unit,
        v_req.roster
    )
    RETURNING id INTO v_schedule_id;

    UPDATE request SET
        person_id = p_person_id,
        status = 'Approved',
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN v_schedule_id;
END;
$$;

/**
 * Move a schedule block (entire) or carve+move a sub-range (e.g. one week).
 *
 * Payload:
 *   id          — schedule uuid
 *   scope       — 'entire' | 'range'
 *   person_id   — target person
 *   start       — target start date
 *   range_start / range_end — required when scope = 'range' (source bounds inside parent)
 *
 * Duration is preserved: new_end = start + (source_end - source_start).
 * Project, roster, unit, billable/booking/title are kept from the parent (or mid slice).
 */
CREATE OR REPLACE FUNCTION move_schedule(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
    v_scope TEXT;
    v_person_id UUID;
    v_start DATE;
    v_range_start DATE;
    v_range_end DATE;
    v_parent schedule%ROWTYPE;
    v_src_start DATE;
    v_src_end DATE;
    v_new_end DATE;
    v_duration INT;
    v_has_head BOOLEAN;
    v_has_tail BOOLEAN;
    v_head_end DATE;
    v_tail_start DATE;
    v_mid_id UUID;
    v_tail_id UUID;
    v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'payload must be a JSON object';
    END IF;

    v_id := NULLIF(p_payload->>'id', '')::UUID;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'id is required';
    END IF;

    v_scope := lower(trim(COALESCE(p_payload->>'scope', 'entire')));
    IF v_scope NOT IN ('entire', 'range') THEN
        RAISE EXCEPTION 'scope must be entire or range';
    END IF;

    v_person_id := COALESCE(
        NULLIF(p_payload->>'person_id', '')::UUID,
        NULLIF(p_payload->>'resourceId', '')::UUID
    );
    IF v_person_id IS NULL THEN
        RAISE EXCEPTION 'person_id is required';
    END IF;

    v_start := COALESCE(
        NULLIF(p_payload->>'start', '')::DATE,
        NULLIF(p_payload->>'start_date', '')::DATE
    );
    IF v_start IS NULL THEN
        RAISE EXCEPTION 'start is required';
    END IF;

    SELECT * INTO v_parent FROM schedule WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'schedule not found: %', v_id;
    END IF;

    IF v_scope = 'range' THEN
        v_range_start := COALESCE(
            NULLIF(p_payload->>'range_start', '')::DATE,
            NULLIF(p_payload->>'rangeStart', '')::DATE
        );
        v_range_end := COALESCE(
            NULLIF(p_payload->>'range_end', '')::DATE,
            NULLIF(p_payload->>'rangeEnd', '')::DATE
        );
        IF v_range_start IS NULL OR v_range_end IS NULL THEN
            RAISE EXCEPTION 'range_start and range_end are required for scope=range';
        END IF;
        IF v_range_end < v_range_start THEN
            RAISE EXCEPTION 'range_end must be on or after range_start';
        END IF;
        IF v_range_start < v_parent.start_date OR v_range_end > v_parent.end_date THEN
            RAISE EXCEPTION 'range must be within schedule bounds [% - %]',
                v_parent.start_date, v_parent.end_date;
        END IF;

        -- Full-range move behaves as entire.
        IF v_range_start = v_parent.start_date AND v_range_end = v_parent.end_date THEN
            v_scope := 'entire';
        ELSE
            v_src_start := v_range_start;
            v_src_end := v_range_end;
        END IF;
    END IF;

    IF v_scope = 'entire' THEN
        v_src_start := v_parent.start_date;
        v_src_end := v_parent.end_date;
        v_duration := v_src_end - v_src_start;
        v_new_end := v_start + v_duration;

        IF v_person_id = v_parent.person_id
           AND v_start = v_parent.start_date
           AND v_new_end = v_parent.end_date THEN
            RETURN jsonb_build_object('ids', jsonb_build_array(v_id));
        END IF;

        UPDATE schedule SET
            person_id = v_person_id,
            start_date = v_start,
            end_date = v_new_end,
            updated_at = NOW()
        WHERE id = v_id;

        RETURN jsonb_build_object('ids', jsonb_build_array(v_id));
    END IF;

    -- scope = range: carve mid and place on target person/dates.
    v_duration := v_src_end - v_src_start;
    v_new_end := v_start + v_duration;

    v_has_head := v_range_start > v_parent.start_date;
    v_has_tail := v_range_end < v_parent.end_date;
    v_head_end := v_range_start - 1;
    v_tail_start := v_range_end + 1;

    IF v_has_head THEN
        UPDATE schedule SET
            end_date = v_head_end,
            updated_at = NOW()
        WHERE id = v_id;

        INSERT INTO schedule (
            title, person_id, project_id, request_id,
            billable_type, booking_type,
            start_date, end_date, unit, roster
        ) VALUES (
            v_parent.title, v_person_id, v_parent.project_id, v_parent.request_id,
            v_parent.billable_type, v_parent.booking_type,
            v_start, v_new_end, v_parent.unit, v_parent.roster
        )
        RETURNING id INTO v_mid_id;

        v_ids := ARRAY[v_id, v_mid_id];

        IF v_has_tail THEN
            INSERT INTO schedule (
                title, person_id, project_id, request_id,
                billable_type, booking_type,
                start_date, end_date, unit, roster
            ) VALUES (
                v_parent.title, v_parent.person_id, v_parent.project_id, v_parent.request_id,
                v_parent.billable_type, v_parent.booking_type,
                v_tail_start, v_parent.end_date, v_parent.unit, v_parent.roster
            )
            RETURNING id INTO v_tail_id;
            v_ids := v_ids || v_tail_id;
        END IF;
    ELSE
        -- No head: convert parent into moved mid; optional tail on original person.
        UPDATE schedule SET
            person_id = v_person_id,
            start_date = v_start,
            end_date = v_new_end,
            updated_at = NOW()
        WHERE id = v_id;

        v_ids := ARRAY[v_id];

        IF v_has_tail THEN
            INSERT INTO schedule (
                title, person_id, project_id, request_id,
                billable_type, booking_type,
                start_date, end_date, unit, roster
            ) VALUES (
                v_parent.title, v_parent.person_id, v_parent.project_id, v_parent.request_id,
                v_parent.billable_type, v_parent.booking_type,
                v_tail_start, v_parent.end_date, v_parent.unit, v_parent.roster
            )
            RETURNING id INTO v_tail_id;
            v_ids := v_ids || v_tail_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'ids',
        COALESCE(
            (SELECT jsonb_agg(x ORDER BY ord)
             FROM unnest(v_ids) WITH ORDINALITY AS t(x, ord)),
            '[]'::jsonb
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION assert_schedule_no_person_project_overlap(UUID, UUID, DATE, DATE, UUID)
    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_schedule(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION copy_request_to_schedule(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION move_schedule(JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
