ALTER TABLE project ADD COLUMN reference_id TEXT;

UPDATE project SET reference_id = 'NW-PROJ-001' WHERE project_id = 'PRJ-PHOENIX';
UPDATE project SET reference_id = 'NW-PROJ-002' WHERE project_id = 'PRJ-ATLAS';
UPDATE project SET reference_id = 'NW-PROJ-003' WHERE project_id = 'PRJ-HORIZON';
UPDATE project SET reference_id = 'NW-PROJ-004' WHERE project_id = 'PRJ-SUPPORT';
UPDATE project SET reference_id = 'NW-PROJ-005' WHERE project_id = 'PRJ-SUMMIT';

ALTER TABLE project ALTER COLUMN reference_id SET NOT NULL;
CREATE UNIQUE INDEX idx_project_reference_id ON project(reference_id);

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
            reference_id,
            project_id,
            name,
            manager_id,
            market_unit_id,
            consulting_unit_id,
            win_probability
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

GRANT EXECUTE ON FUNCTION publish_lab_projects(TEXT, JSONB) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
