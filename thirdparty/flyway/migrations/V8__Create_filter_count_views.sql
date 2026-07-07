-- Match helpers: criteria JSON keys are optional; empty {} matches all rows.

CREATE OR REPLACE FUNCTION project_matches_filter_criteria(
    p_project project,
    p_criteria JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        p_criteria IS NULL
        OR p_criteria = '{}'::jsonb
        OR (
            (NOT p_criteria ? 'consulting_unit_id' OR p_project.consulting_unit_id::text = p_criteria->>'consulting_unit_id')
            AND (NOT p_criteria ? 'market_unit_id' OR p_project.market_unit_id::text = p_criteria->>'market_unit_id')
            AND (
                NOT p_criteria ? 'win_probability_lt'
                OR COALESCE(p_project.win_probability, 100) < (p_criteria->>'win_probability_lt')::numeric
            )
        );
$$;

CREATE OR REPLACE FUNCTION person_matches_filter_criteria(
    p_person person,
    p_criteria JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT
        p_criteria IS NULL
        OR p_criteria = '{}'::jsonb
        OR (
            (NOT p_criteria ? 'site_id' OR p_person.site_id::text = p_criteria->>'site_id')
            AND (NOT p_criteria ? 'consulting_unit_id' OR p_person.consulting_unit_id::text = p_criteria->>'consulting_unit_id')
            AND (NOT p_criteria ? 'practice_area_id' OR p_person.practice_area_id::text = p_criteria->>'practice_area_id')
            AND (NOT p_criteria ? 'lifecycle_status' OR p_person.lifecycle_status::text = p_criteria->>'lifecycle_status')
            AND (NOT p_criteria ? 'status' OR p_person.status::text = p_criteria->>'status')
        );
$$;

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
            AND (NOT p_criteria ? 'billable_type' OR p_request.billable_type::text = p_criteria->>'billable_type')
            AND (
                NOT p_criteria ? 'unassigned_only'
                OR COALESCE((p_criteria->>'unassigned_only')::boolean, false) = false
                OR p_request.person_id IS NULL
            )
            AND (
                NOT p_criteria ? 'project_consulting_unit_id'
                OR EXISTS (
                    SELECT 1
                    FROM project p
                    WHERE p.id = p_request.project_id
                      AND p.consulting_unit_id::text = p_criteria->>'project_consulting_unit_id'
                )
            )
        );
$$;

CREATE OR REPLACE VIEW project_filter_with_count AS
SELECT
    pf.id,
    pf.name,
    pf.description,
    pf.criteria,
    pf.is_active,
    pf.sort_order,
    pf.created_at,
    pf.updated_at,
    (
        SELECT COUNT(*)::integer
        FROM project p
        WHERE project_matches_filter_criteria(p, pf.criteria)
    ) AS item_count
FROM project_filter pf;

CREATE OR REPLACE VIEW person_filter_with_count AS
SELECT
    pf.id,
    pf.name,
    pf.description,
    pf.criteria,
    pf.is_active,
    pf.sort_order,
    pf.created_at,
    pf.updated_at,
    (
        SELECT COUNT(*)::integer
        FROM person per
        WHERE person_matches_filter_criteria(per, pf.criteria)
    ) AS item_count
FROM person_filter pf;

CREATE OR REPLACE VIEW request_filter_with_count AS
SELECT
    rf.id,
    rf.name,
    rf.description,
    rf.criteria,
    rf.is_active,
    rf.sort_order,
    rf.created_at,
    rf.updated_at,
    (
        SELECT COUNT(*)::integer
        FROM request r
        WHERE request_matches_filter_criteria(r, rf.criteria)
    ) AS item_count
FROM request_filter rf;

GRANT SELECT ON project_filter_with_count TO anon, authenticated, service_role;
GRANT SELECT ON person_filter_with_count TO anon, authenticated, service_role;
GRANT SELECT ON request_filter_with_count TO anon, authenticated, service_role;
