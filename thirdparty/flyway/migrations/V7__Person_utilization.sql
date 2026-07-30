-- Days-based utilization per ISO week for one person.

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
    WITH weeks_in_range AS (
        SELECT cw.iso_year, cw.iso_week, cw.week_start, cw.week_end
        FROM calendar_week cw
        WHERE cw.week_start <= p_to
          AND cw.week_end >= p_from
        ORDER BY cw.iso_year, cw.iso_week
    ),
    weekly_totals AS (
        SELECT
            w.iso_year,
            w.iso_week,
            w.week_start,
            w.week_end,
            COALESCE((
                SELECT SUM(sw.days_per_week)::integer
                FROM schedule_week sw
                WHERE sw.person_id = p_person_id
                  AND sw.iso_year = w.iso_year
                  AND sw.iso_week = w.iso_week
            ), 0) AS allocated_days
        FROM weeks_in_range w
    ),
    segments AS (
        SELECT
            wt.iso_year,
            wt.iso_week,
            GREATEST(wt.week_start, p_from) AS from_date,
            LEAST(wt.week_end, p_to) AS to_date,
            wt.allocated_days AS util
        FROM weekly_totals wt
    ),
    week_count AS (
        SELECT GREATEST(COUNT(*)::numeric, 1) AS n FROM segments
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
        (SELECT ROUND(AVG(s.util)::numeric, 2) FROM segments s),
        (SELECT ROUND(AVG(GREATEST(0, 5 - s.util))::numeric, 2) FROM segments s);
$$;

CREATE OR REPLACE FUNCTION person_utilization_search(
    p_from DATE,
    p_to DATE,
    p_availability TEXT DEFAULT 'everyone',
    p_required_days SMALLINT DEFAULT 5,
    p_consulting_unit_id UUID DEFAULT NULL,
    p_practice_area_id UUID DEFAULT NULL,
    p_competency_center_id UUID DEFAULT NULL,
    p_site_id UUID DEFAULT NULL,
    p_job_level_id UUID DEFAULT NULL,
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
    job_level_id UUID,
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
    WITH params AS (
        SELECT GREATEST(0, LEAST(5, COALESCE(p_required_days, 5)))::numeric AS required_days
    ),
    candidates AS (
        SELECT
            p.id, p.employee_id, p.first_name, p.last_name, p.email,
            p.global_designation, p.local_designation, p.job_level_id,
            p.consulting_unit_id, p.practice_area_id, p.competency_center_id, p.site_id,
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
          AND (p_job_level_id IS NULL OR p.job_level_id = p_job_level_id)
          AND (
              p_name IS NULL OR btrim(p_name) = ''
              OR (p.first_name || ' ' || p.last_name) ILIKE ('%' || btrim(p_name) || '%')
              OR p.first_name ILIKE ('%' || btrim(p_name) || '%')
              OR p.last_name ILIKE ('%' || btrim(p_name) || '%')
          )
    ),
    with_util AS (
        SELECT c.*, u.utilization, u.avg_utilization, u.avg_availability
        FROM candidates c
        CROSS JOIN LATERAL person_period_utilization(c.id, p_from, p_to) u
    )
    SELECT
        w.id, w.employee_id, w.first_name, w.last_name, w.email,
        w.global_designation, w.local_designation, w.job_level_id,
        w.consulting_unit_id, w.practice_area_id, w.competency_center_id, w.site_id,
        w.consulting_unit_name, w.practice_area_name, w.competency_center_name, w.site_name,
        w.utilization, w.avg_utilization, w.avg_availability
    FROM with_util w
    CROSS JOIN params par
    WHERE CASE lower(COALESCE(p_availability, 'everyone'))
        WHEN 'complete' THEN w.avg_availability >= par.required_days
        WHEN 'partial' THEN w.avg_availability >= (par.required_days * 0.75)
        ELSE TRUE
    END
    ORDER BY w.last_name ASC, w.first_name ASC;
$$;

GRANT EXECUTE ON FUNCTION person_period_utilization(UUID, DATE, DATE)
    TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION person_utilization_search(DATE, DATE, TEXT, SMALLINT, UUID, UUID, UUID, UUID, UUID, TEXT)
    TO anon, authenticated, service_role;
