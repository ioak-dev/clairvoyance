CREATE OR REPLACE FUNCTION parse_roster_json(p_roster JSONB)
RETURNS NUMERIC(8, 4)[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_roster NUMERIC(8, 4)[];
    v_elem JSONB;
    v_i INT := 1;
BEGIN
    IF p_roster IS NULL OR jsonb_typeof(p_roster) <> 'array' OR jsonb_array_length(p_roster) <> 7 THEN
        RAISE EXCEPTION 'roster must be a JSON array of length 7 (Mon..Sun)';
    END IF;

    v_roster := ARRAY[]::NUMERIC(8, 4)[];
    FOR v_elem IN SELECT value FROM jsonb_array_elements(p_roster)
    LOOP
        IF jsonb_typeof(v_elem) NOT IN ('number') THEN
            RAISE EXCEPTION 'roster[%] must be a number', v_i;
        END IF;
        IF (v_elem::TEXT)::NUMERIC < 0 THEN
            RAISE EXCEPTION 'roster[%] must be >= 0', v_i;
        END IF;
        v_roster := array_append(v_roster, (v_elem::TEXT)::NUMERIC(8, 4));
        v_i := v_i + 1;
    END LOOP;

    RETURN v_roster;
END;
$$;

CREATE OR REPLACE FUNCTION publish_lab_requests(
    p_type TEXT,
    p_payload JSONB
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_log_id UUID;
    v_elem JSONB;
    v_ref_id TEXT;
    v_request_id UUID;
    v_upserted_count INT := 0;
    v_cleared_count INT := 0;
    v_row_cleared INT;
    v_start DATE;
    v_end DATE;
    v_unit schedule_unit;
    v_roster NUMERIC(8, 4)[];
BEGIN
    IF p_type IS NULL OR trim(p_type) = '' THEN
        RAISE EXCEPTION 'type is required';
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'array' THEN
        RAISE EXCEPTION 'payload must be a JSON array';
    END IF;

    INSERT INTO simulation_log (simulation_type, payload, record_count)
    VALUES (p_type, p_payload, jsonb_array_length(p_payload))
    RETURNING id INTO v_log_id;

    FOR v_elem IN SELECT value FROM jsonb_array_elements(p_payload)
    LOOP
        v_ref_id := v_elem->>'id';
        IF v_ref_id IS NULL OR trim(v_ref_id) = '' THEN
            RAISE EXCEPTION 'each payload item must have a non-empty id (reference_id)';
        END IF;

        IF v_elem ? 'weeks' OR v_elem ? 'days_per_week' OR v_elem ? 'billable_percent' THEN
            RAISE EXCEPTION 'payload must use start/end/unit/roster; weeks and days_per_week are not supported';
        END IF;

        v_start := COALESCE(
            NULLIF(v_elem->>'start', '')::DATE,
            NULLIF(v_elem->>'start_date', '')::DATE
        );
        v_end := COALESCE(
            NULLIF(v_elem->>'end', '')::DATE,
            NULLIF(v_elem->>'end_date', '')::DATE
        );
        IF v_start IS NULL OR v_end IS NULL THEN
            RAISE EXCEPTION 'each payload item must include start and end dates';
        END IF;
        IF v_end < v_start THEN
            RAISE EXCEPTION 'end must be on or after start for %', v_ref_id;
        END IF;

        v_unit := COALESCE((v_elem->>'unit')::schedule_unit, 'utilization');
        v_roster := parse_roster_json(COALESCE(v_elem->'roster', '[1,1,1,1,1,0,0]'::jsonb));

        INSERT INTO request (
            reference_id, project_id, person_id,
            billable_type, booking_type, probability, status,
            request_name, notes,
            consulting_unit_id, practice_area_id, competency_center_id, site_id, job_level_id,
            start_date, end_date, unit, roster
        ) VALUES (
            v_ref_id,
            (v_elem->>'project_id')::UUID,
            NULLIF(v_elem->>'person_id', '')::UUID,
            (v_elem->>'billable_type')::billable_type,
            COALESCE((v_elem->>'booking_type')::booking_type, 'hard'),
            COALESCE((v_elem->>'probability')::SMALLINT, 100),
            COALESCE((v_elem->>'status')::approval_status, 'Pending'),
            COALESCE(NULLIF(v_elem->>'request_name', ''), NULLIF(v_elem->>'required_skill', ''), NULLIF(v_elem->>'title', '')),
            NULLIF(v_elem->>'notes', ''),
            NULLIF(v_elem->>'consulting_unit_id', '')::UUID,
            NULLIF(v_elem->>'practice_area_id', '')::UUID,
            NULLIF(v_elem->>'competency_center_id', '')::UUID,
            NULLIF(v_elem->>'site_id', '')::UUID,
            NULLIF(v_elem->>'job_level_id', '')::UUID,
            v_start,
            v_end,
            v_unit,
            v_roster
        )
        ON CONFLICT (reference_id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            person_id = EXCLUDED.person_id,
            billable_type = EXCLUDED.billable_type,
            booking_type = EXCLUDED.booking_type,
            probability = EXCLUDED.probability,
            status = EXCLUDED.status,
            request_name = EXCLUDED.request_name,
            notes = EXCLUDED.notes,
            consulting_unit_id = EXCLUDED.consulting_unit_id,
            practice_area_id = EXCLUDED.practice_area_id,
            competency_center_id = EXCLUDED.competency_center_id,
            site_id = EXCLUDED.site_id,
            job_level_id = EXCLUDED.job_level_id,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            unit = EXCLUDED.unit,
            roster = EXCLUDED.roster,
            updated_at = NOW()
        RETURNING id INTO v_request_id;

        v_upserted_count := v_upserted_count + 1;

        DELETE FROM schedule WHERE request_id = v_request_id;
        GET DIAGNOSTICS v_row_cleared = ROW_COUNT;
        v_cleared_count := v_cleared_count + v_row_cleared;
    END LOOP;

    RETURN jsonb_build_object(
        'simulation_log_id', v_log_id,
        'upserted_count', v_upserted_count,
        'cleared_schedule_count', v_cleared_count
    );
END;
$$;

CREATE OR REPLACE FUNCTION publish_lab_projects(
    p_type TEXT,
    p_payload JSONB
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_log_id UUID;
    v_elem JSONB;
    v_ref_id TEXT;
    v_win_probability NUMERIC(5, 2);
    v_upserted_count INT := 0;
BEGIN
    IF p_type IS NULL OR trim(p_type) = '' THEN
        RAISE EXCEPTION 'type is required';
    END IF;

    IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'array' THEN
        RAISE EXCEPTION 'payload must be a JSON array';
    END IF;

    INSERT INTO simulation_log (simulation_type, payload, record_count)
    VALUES (p_type, p_payload, jsonb_array_length(p_payload))
    RETURNING id INTO v_log_id;

    FOR v_elem IN SELECT value FROM jsonb_array_elements(p_payload)
    LOOP
        v_ref_id := v_elem->>'id';
        IF v_ref_id IS NULL OR trim(v_ref_id) = '' THEN
            RAISE EXCEPTION 'each payload item must have a non-empty id (reference_id)';
        END IF;

        v_win_probability := COALESCE((v_elem->>'win_probability')::NUMERIC(5, 2), 100);
        IF v_win_probability >= 100 THEN
            RAISE EXCEPTION 'Lab project publish only supports opportunities (win_probability must be below 100)';
        END IF;

        INSERT INTO project (
            reference_id, project_id, name,
            manager_id, market_unit_id, consulting_unit_id, win_probability
        ) VALUES (
            v_ref_id,
            COALESCE(NULLIF(trim(v_elem->>'project_id'), ''), v_ref_id),
            v_elem->>'name',
            NULLIF(v_elem->>'manager_id', '')::UUID,
            NULLIF(v_elem->>'market_unit_id', '')::UUID,
            NULLIF(v_elem->>'consulting_unit_id', '')::UUID,
            v_win_probability
        )
        ON CONFLICT (reference_id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            name = EXCLUDED.name,
            manager_id = EXCLUDED.manager_id,
            market_unit_id = EXCLUDED.market_unit_id,
            consulting_unit_id = EXCLUDED.consulting_unit_id,
            win_probability = EXCLUDED.win_probability,
            updated_at = NOW();

        v_upserted_count := v_upserted_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'simulation_log_id', v_log_id,
        'upserted_count', v_upserted_count,
        'cleared_schedule_count', 0
    );
END;
$$;

GRANT EXECUTE ON FUNCTION publish_lab_requests(TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION publish_lab_projects(TEXT, JSONB) TO anon, authenticated, service_role;
