-- Carve a sub-range of a schedule into up to 3 adjacent blocks, and split at a date.

CREATE OR REPLACE FUNCTION replace_schedule_range(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
    v_range_start DATE;
    v_range_end DATE;
    v_unit schedule_unit;
    v_roster NUMERIC(8, 4)[];
    v_title TEXT;
    v_parent schedule%ROWTYPE;
    v_has_head BOOLEAN;
    v_has_tail BOOLEAN;
    v_head_end DATE;
    v_tail_start DATE;
    v_mid_id UUID;
    v_tail_id UUID;
    v_ids UUID[] := ARRAY[]::UUID[];
    v_mid_title TEXT;
BEGIN
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'payload must be a JSON object';
    END IF;

    v_id := NULLIF(p_payload->>'id', '')::UUID;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'id is required';
    END IF;

    v_range_start := COALESCE(
        NULLIF(p_payload->>'range_start', '')::DATE,
        NULLIF(p_payload->>'rangeStart', '')::DATE
    );
    v_range_end := COALESCE(
        NULLIF(p_payload->>'range_end', '')::DATE,
        NULLIF(p_payload->>'rangeEnd', '')::DATE
    );
    IF v_range_start IS NULL OR v_range_end IS NULL THEN
        RAISE EXCEPTION 'range_start and range_end are required';
    END IF;
    IF v_range_end < v_range_start THEN
        RAISE EXCEPTION 'range_end must be on or after range_start';
    END IF;

    SELECT * INTO v_parent FROM schedule WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'schedule not found: %', v_id;
    END IF;

    IF v_range_start < v_parent.start_date OR v_range_end > v_parent.end_date THEN
        RAISE EXCEPTION 'range must be within schedule bounds [% - %]',
            v_parent.start_date, v_parent.end_date;
    END IF;

    v_unit := COALESCE((p_payload->>'unit')::schedule_unit, v_parent.unit);
    IF p_payload ? 'roster' AND p_payload->'roster' IS NOT NULL THEN
        v_roster := parse_roster_json(p_payload->'roster');
    ELSE
        v_roster := v_parent.roster;
    END IF;

    IF p_payload ? 'title' THEN
        v_mid_title := NULLIF(trim(COALESCE(p_payload->>'title', '')), '');
    ELSE
        v_mid_title := v_parent.title;
    END IF;

    -- Full-range replace: update in place.
    IF v_range_start = v_parent.start_date AND v_range_end = v_parent.end_date THEN
        UPDATE schedule SET
            title = v_mid_title,
            unit = v_unit,
            roster = v_roster,
            updated_at = NOW()
        WHERE id = v_id;
        RETURN jsonb_build_object('ids', jsonb_build_array(v_id));
    END IF;

    v_has_head := v_range_start > v_parent.start_date;
    v_has_tail := v_range_end < v_parent.end_date;
    v_head_end := v_range_start - 1;
    v_tail_start := v_range_end + 1;

    IF v_has_head THEN
        -- Keep parent id on head; insert middle (and maybe tail).
        UPDATE schedule SET
            end_date = v_head_end,
            updated_at = NOW()
        WHERE id = v_id;

        INSERT INTO schedule (
            title, person_id, project_id, request_id,
            billable_type, booking_type,
            start_date, end_date, unit, roster
        ) VALUES (
            v_mid_title, v_parent.person_id, v_parent.project_id, v_parent.request_id,
            v_parent.billable_type, v_parent.booking_type,
            v_range_start, v_range_end, v_unit, v_roster
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
        -- No head: keep parent id on middle; optional tail insert.
        UPDATE schedule SET
            title = v_mid_title,
            start_date = v_range_start,
            end_date = v_range_end,
            unit = v_unit,
            roster = v_roster,
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

CREATE OR REPLACE FUNCTION split_schedule(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_id UUID;
    v_split_date DATE;
    v_parent schedule%ROWTYPE;
    v_tail_id UUID;
BEGIN
    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
        RAISE EXCEPTION 'payload must be a JSON object';
    END IF;

    v_id := NULLIF(p_payload->>'id', '')::UUID;
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'id is required';
    END IF;

    v_split_date := COALESCE(
        NULLIF(p_payload->>'split_date', '')::DATE,
        NULLIF(p_payload->>'splitDate', '')::DATE
    );
    IF v_split_date IS NULL THEN
        RAISE EXCEPTION 'split_date is required';
    END IF;

    SELECT * INTO v_parent FROM schedule WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'schedule not found: %', v_id;
    END IF;

    IF v_split_date <= v_parent.start_date OR v_split_date > v_parent.end_date THEN
        RAISE EXCEPTION 'split_date must be after start_date and on or before end_date';
    END IF;

    UPDATE schedule SET
        end_date = v_split_date - 1,
        updated_at = NOW()
    WHERE id = v_id;

    INSERT INTO schedule (
        title, person_id, project_id, request_id,
        billable_type, booking_type,
        start_date, end_date, unit, roster
    ) VALUES (
        v_parent.title, v_parent.person_id, v_parent.project_id, v_parent.request_id,
        v_parent.billable_type, v_parent.booking_type,
        v_split_date, v_parent.end_date, v_parent.unit, v_parent.roster
    )
    RETURNING id INTO v_tail_id;

    RETURN jsonb_build_object('ids', jsonb_build_array(v_id, v_tail_id));
END;
$$;

GRANT EXECUTE ON FUNCTION replace_schedule_range(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION split_schedule(JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
