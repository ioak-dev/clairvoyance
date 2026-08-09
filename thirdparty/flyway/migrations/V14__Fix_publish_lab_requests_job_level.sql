-- V14__Fix_publish_lab_requests_job_level.sql
-- Replace job_category with job_level_id in publish_lab_requests function
-- (job_category column was removed from request table in V4 refactor)

CREATE OR REPLACE FUNCTION publish_lab_requests(
    p_type TEXT,
    p_payload JSONB
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_log_id UUID;
    v_elem JSONB;
    v_week JSONB;
    v_ref_id TEXT;
    v_request_id UUID;
    v_upserted_count INT := 0;
    v_cleared_count INT := 0;
    v_row_cleared INT;
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

        IF v_elem->'weeks' IS NULL OR jsonb_typeof(v_elem->'weeks') <> 'array'
           OR jsonb_array_length(v_elem->'weeks') = 0 THEN
            RAISE EXCEPTION 'each payload item must include a non-empty weeks array';
        END IF;

        IF v_elem ? 'start_date' OR v_elem ? 'end_date' OR v_elem ? 'billable_percent' THEN
            RAISE EXCEPTION 'payload must use weeks array; start_date, end_date, and billable_percent are not supported';
        END IF;

        INSERT INTO request (
            reference_id, project_id, person_id,
            billable_type, booking_type, probability, status,
            request_name, notes,
            consulting_unit_id, practice_area_id, competency_center_id, site_id, job_level_id
        ) VALUES (
            v_ref_id,
            (v_elem->>'project_id')::UUID,
            NULLIF(v_elem->>'person_id', '')::UUID,
            (v_elem->>'billable_type')::billable_type,
            COALESCE((v_elem->>'booking_type')::booking_type, 'hard'),
            COALESCE((v_elem->>'probability')::SMALLINT, 100),
            COALESCE((v_elem->>'status')::approval_status, 'Pending'),
            COALESCE(NULLIF(v_elem->>'request_name', ''), NULLIF(v_elem->>'required_skill', '')),
            NULLIF(v_elem->>'notes', ''),
            NULLIF(v_elem->>'consulting_unit_id', '')::UUID,
            NULLIF(v_elem->>'practice_area_id', '')::UUID,
            NULLIF(v_elem->>'competency_center_id', '')::UUID,
            NULLIF(v_elem->>'site_id', '')::UUID,
            NULLIF(v_elem->>'job_level_id', '')::UUID
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
            updated_at = NOW()
        RETURNING id INTO v_request_id;

        DELETE FROM request_week WHERE request_id = v_request_id;

        FOR v_week IN SELECT value FROM jsonb_array_elements(v_elem->'weeks')
        LOOP
            INSERT INTO request_week (request_id, iso_year, iso_week, days_per_week)
            VALUES (
                v_request_id,
                (v_week->>'iso_year')::SMALLINT,
                (v_week->>'iso_week')::SMALLINT,
                (v_week->>'days_per_week')::SMALLINT
            );
        END LOOP;

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

GRANT EXECUTE ON FUNCTION publish_lab_requests(TEXT, JSONB) TO anon, authenticated, service_role;
