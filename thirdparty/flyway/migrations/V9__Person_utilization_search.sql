-- Period utilization segments + averages for one person (calendar-day weighted).
-- Segments split at every clipped schedule start/end boundary; equal neighbors are not merged.

CREATE OR REPLACE FUNCTION person_period_utilization(
    p_person_id UUID,
    p_from DATE,
    p_to DATE
)
RETURNS TABLE (
    utilization JSONB,
    avg_utilization NUMERIC,
    avg_availability NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    WITH clipped AS (
        SELECT
            GREATEST(s.start_date, p_from) AS seg_start,
            LEAST(s.end_date, p_to) AS seg_end,
            s.billable_percent
        FROM schedule s
        WHERE s.person_id = p_person_id
          AND s.start_date <= p_to
          AND s.end_date >= p_from
    ),
    bounds AS (
        SELECT p_from AS d
        UNION
        SELECT p_to + 1
        UNION
        SELECT seg_start FROM clipped
        UNION
        SELECT seg_end + 1 FROM clipped
    ),
    ordered AS (
        SELECT d, LEAD(d) OVER (ORDER BY d) AS d_next
        FROM bounds
    ),
    segments AS (
        SELECT
            o.d AS from_date,
            (o.d_next - 1) AS to_date,
            COALESCE((
                SELECT SUM(c.billable_percent)::integer
                FROM clipped c
                WHERE c.seg_start <= o.d
                  AND c.seg_end >= o.d
            ), 0) AS util,
            (o.d_next - o.d) AS days
        FROM ordered o
        WHERE o.d_next IS NOT NULL
          AND o.d <= p_to
    ),
    period_days AS (
        SELECT GREATEST(p_to - p_from + 1, 1) AS n
    )
    SELECT
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'from', to_char(s.from_date, 'YYYY-MM-DD'),
                    'to', to_char(s.to_date, 'YYYY-MM-DD'),
                    'utilization', s.util
                )
                ORDER BY s.from_date
            )
            FROM segments s
        ),
        (
            SELECT ROUND(SUM(s.util * s.days)::numeric / (SELECT n FROM period_days), 2)
            FROM segments s
        ),
        (
            SELECT ROUND(SUM(GREATEST(0, 100 - s.util) * s.days)::numeric / (SELECT n FROM period_days), 2)
            FROM segments s
        );
$$;

CREATE OR REPLACE FUNCTION person_utilization_search(
    p_from DATE,
    p_to DATE,
    p_availability TEXT DEFAULT 'everyone',
    p_consulting_unit_id UUID DEFAULT NULL,
    p_practice_area_id UUID DEFAULT NULL,
    p_competency_center_id UUID DEFAULT NULL,
    p_site_id UUID DEFAULT NULL,
    p_job_category TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    employee_id TEXT,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    global_designation TEXT,
    local_designation TEXT,
    job_category TEXT,
    consulting_unit_id UUID,
    practice_area_id UUID,
    competency_center_id UUID,
    site_id UUID,
    consulting_unit_name TEXT,
    practice_area_name TEXT,
    competency_center_name TEXT,
    site_name TEXT,
    utilization JSONB,
    avg_utilization NUMERIC,
    avg_availability NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    WITH candidates AS (
        SELECT
            p.id,
            p.employee_id,
            p.first_name,
            p.last_name,
            p.email,
            p.global_designation,
            p.local_designation,
            p.job_category,
            p.consulting_unit_id,
            p.practice_area_id,
            p.competency_center_id,
            p.site_id,
            cu.name AS consulting_unit_name,
            pa.name AS practice_area_name,
            cc.name AS competency_center_name,
            si.name AS site_name
        FROM person p
        LEFT JOIN consulting_unit cu ON cu.id = p.consulting_unit_id
        LEFT JOIN practice_area pa ON pa.id = p.practice_area_id
        LEFT JOIN competency_center cc ON cc.id = p.competency_center_id
        LEFT JOIN site si ON si.id = p.site_id
        WHERE p.status = 'Active'
          AND (p_consulting_unit_id IS NULL OR p.consulting_unit_id = p_consulting_unit_id)
          AND (p_practice_area_id IS NULL OR p.practice_area_id = p_practice_area_id)
          AND (p_competency_center_id IS NULL OR p.competency_center_id = p_competency_center_id)
          AND (p_site_id IS NULL OR p.site_id = p_site_id)
          AND (p_job_category IS NULL OR p.job_category = p_job_category)
          AND (
              p_name IS NULL
              OR btrim(p_name) = ''
              OR (p.first_name || ' ' || p.last_name) ILIKE ('%' || btrim(p_name) || '%')
              OR p.first_name ILIKE ('%' || btrim(p_name) || '%')
              OR p.last_name ILIKE ('%' || btrim(p_name) || '%')
          )
    ),
    with_util AS (
        SELECT
            c.*,
            u.utilization,
            u.avg_utilization,
            u.avg_availability
        FROM candidates c
        CROSS JOIN LATERAL person_period_utilization(c.id, p_from, p_to) u
    )
    SELECT
        w.id,
        w.employee_id,
        w.first_name,
        w.last_name,
        w.email,
        w.global_designation,
        w.local_designation,
        w.job_category,
        w.consulting_unit_id,
        w.practice_area_id,
        w.competency_center_id,
        w.site_id,
        w.consulting_unit_name,
        w.practice_area_name,
        w.competency_center_name,
        w.site_name,
        w.utilization,
        w.avg_utilization,
        w.avg_availability
    FROM with_util w
    WHERE
        CASE lower(COALESCE(p_availability, 'everyone'))
            WHEN 'complete' THEN w.avg_utilization = 0
            WHEN 'partial' THEN w.avg_utilization > 0 AND w.avg_utilization < 75
            ELSE TRUE
        END
    ORDER BY w.last_name ASC, w.first_name ASC;
$$;

GRANT EXECUTE ON FUNCTION person_period_utilization(UUID, DATE, DATE)
    TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION person_utilization_search(DATE, DATE, TEXT, UUID, UUID, UUID, UUID, TEXT, TEXT)
    TO anon, authenticated, service_role;
