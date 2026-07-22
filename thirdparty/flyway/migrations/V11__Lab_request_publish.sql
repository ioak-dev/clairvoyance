CREATE TABLE simulation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    record_count INT NOT NULL CHECK (record_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER simulation_log_set_updated_at
    BEFORE UPDATE ON simulation_log
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT ON simulation_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON simulation_log TO authenticated, service_role;

GRANT INSERT ON simulation_log TO anon;

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

        INSERT INTO request (
            reference_id,
            project_id,
            person_id,
            start_date,
            end_date,
            billable_percent,
            billable_type,
            booking_type,
            probability,
            status,
            required_skill,
            notes,
            consulting_unit_id,
            practice_area_id,
            competency_center_id,
            site_id,
            job_category
        ) VALUES (
            v_ref_id,
            (v_elem->>'project_id')::UUID,
            NULLIF(v_elem->>'person_id', '')::UUID,
            (v_elem->>'start_date')::DATE,
            (v_elem->>'end_date')::DATE,
            (v_elem->>'billable_percent')::SMALLINT,
            (v_elem->>'billable_type')::billable_type,
            COALESCE((v_elem->>'booking_type')::booking_type, 'hard'),
            COALESCE((v_elem->>'probability')::SMALLINT, 100),
            COALESCE((v_elem->>'status')::approval_status, 'Pending'),
            NULLIF(v_elem->>'required_skill', ''),
            NULLIF(v_elem->>'notes', ''),
            NULLIF(v_elem->>'consulting_unit_id', '')::UUID,
            NULLIF(v_elem->>'practice_area_id', '')::UUID,
            NULLIF(v_elem->>'competency_center_id', '')::UUID,
            NULLIF(v_elem->>'site_id', '')::UUID,
            NULLIF(v_elem->>'job_category', '')
        )
        ON CONFLICT (reference_id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            person_id = EXCLUDED.person_id,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            billable_percent = EXCLUDED.billable_percent,
            billable_type = EXCLUDED.billable_type,
            booking_type = EXCLUDED.booking_type,
            probability = EXCLUDED.probability,
            status = EXCLUDED.status,
            required_skill = EXCLUDED.required_skill,
            notes = EXCLUDED.notes,
            consulting_unit_id = EXCLUDED.consulting_unit_id,
            practice_area_id = EXCLUDED.practice_area_id,
            competency_center_id = EXCLUDED.competency_center_id,
            site_id = EXCLUDED.site_id,
            job_category = EXCLUDED.job_category,
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

GRANT EXECUTE ON FUNCTION publish_lab_requests(TEXT, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
