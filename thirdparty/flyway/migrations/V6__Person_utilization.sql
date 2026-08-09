-- Daily capacity in hours for a person (defaults: 40h/week, FTE 1).
CREATE OR REPLACE FUNCTION person_daily_capacity_hours(
    p_weekly_hours NUMERIC,
    p_fte NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT GREATEST(0, COALESCE(p_weekly_hours, 40) / 5.0 * COALESCE(p_fte, 1));
$$;

-- Convert a roster slot to hours given unit + person capacity.
CREATE OR REPLACE FUNCTION roster_slot_hours(
    p_unit schedule_unit,
    p_raw NUMERIC,
    p_daily_capacity NUMERIC
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_unit = 'hours' THEN COALESCE(p_raw, 0)
        ELSE COALESCE(p_raw, 0) * COALESCE(p_daily_capacity, 0)
    END;
$$;

-- ISO weekday index Mon=0 .. Sun=6 for a date.
CREATE OR REPLACE FUNCTION iso_weekday_index(p_date DATE)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT ((EXTRACT(ISODOW FROM p_date)::INT) - 1);
$$;

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
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_capacity NUMERIC;
    v_days INT;
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
        RAISE EXCEPTION 'p_from and p_to required with p_to >= p_from';
    END IF;

    SELECT person_daily_capacity_hours(pe.weekly_hours, pe.fte)
    INTO v_capacity
    FROM person pe
    WHERE pe.id = p_person_id;

    IF v_capacity IS NULL THEN
        RAISE EXCEPTION 'person not found: %', p_person_id;
    END IF;

    v_days := (p_to - p_from) + 1;

    RETURN QUERY
    WITH days AS (
        SELECT generate_series(p_from, p_to, '1 day'::interval)::date AS d
    ),
    daily AS (
        SELECT
            days.d AS day_date,
            COALESCE(SUM(
                roster_slot_hours(
                    s.unit,
                    s.roster[iso_weekday_index(days.d) + 1],
                    v_capacity
                )
            ), 0)::NUMERIC AS hours
        FROM days
        LEFT JOIN schedule s
            ON s.person_id = p_person_id
           AND s.start_date <= days.d
           AND s.end_date >= days.d
        GROUP BY days.d
    ),
    agg AS (
        SELECT
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'date', to_char(day_date, 'YYYY-MM-DD'),
                        'hours', ROUND(hours, 2),
                        'utilization', CASE
                            WHEN v_capacity > 0 THEN ROUND(hours / v_capacity, 4)
                            ELSE 0
                        END
                    )
                    ORDER BY day_date
                ),
                '[]'::jsonb
            ) AS util_json,
            ROUND(AVG(
                CASE
                    WHEN v_capacity > 0 THEN hours / v_capacity
                    ELSE 0
                END
            ), 4) AS avg_util,
            ROUND(AVG(
                CASE
                    WHEN v_capacity > 0 THEN GREATEST(0, v_capacity - hours) / v_capacity
                    ELSE 0
                END
            ), 4) AS avg_avail
        FROM daily
    )
    SELECT util_json, avg_util, avg_avail FROM agg;
END;
$$;

CREATE OR REPLACE FUNCTION person_utilization_search(
    p_from DATE,
    p_to DATE,
    p_availability TEXT DEFAULT 'everyone',
    p_required_hours NUMERIC DEFAULT 8,
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
    status TEXT,
    consulting_unit_id UUID,
    consulting_unit_name TEXT,
    practice_area_id UUID,
    practice_area_name TEXT,
    competency_center_id UUID,
    competency_center_name TEXT,
    site_id UUID,
    site_name TEXT,
    job_level_id UUID,
    job_level_code TEXT,
    job_level_name TEXT,
    utilization JSONB,
    avg_utilization NUMERIC,
    avg_availability NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_mode TEXT := COALESCE(NULLIF(trim(lower(p_availability)), ''), 'everyone');
BEGIN
    IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
        RAISE EXCEPTION 'p_from and p_to required with p_to >= p_from';
    END IF;

    IF v_mode NOT IN ('complete', 'partial', 'everyone') THEN
        RAISE EXCEPTION 'p_availability must be complete, partial, or everyone';
    END IF;

    RETURN QUERY
    SELECT
        pe.id,
        pe.employee_id,
        pe.first_name,
        pe.last_name,
        pe.email,
        pe.status,
        pe.consulting_unit_id,
        cu.name AS consulting_unit_name,
        pe.practice_area_id,
        pa.name AS practice_area_name,
        pe.competency_center_id,
        cc.name AS competency_center_name,
        pe.site_id,
        si.name AS site_name,
        pe.job_level_id,
        jl.level_code AS job_level_code,
        jl.level_name AS job_level_name,
        util.utilization,
        util.avg_utilization,
        util.avg_availability
    FROM person pe
    LEFT JOIN consulting_unit cu ON cu.id = pe.consulting_unit_id
    LEFT JOIN practice_area pa ON pa.id = pe.practice_area_id
    LEFT JOIN competency_center cc ON cc.id = pe.competency_center_id
    LEFT JOIN site si ON si.id = pe.site_id
    LEFT JOIN job_level jl ON jl.id = pe.job_level_id
    CROSS JOIN LATERAL person_period_utilization(pe.id, p_from, p_to) util
    WHERE pe.status = 'Active'
      AND (p_consulting_unit_id IS NULL OR pe.consulting_unit_id = p_consulting_unit_id)
      AND (p_practice_area_id IS NULL OR pe.practice_area_id = p_practice_area_id)
      AND (p_competency_center_id IS NULL OR pe.competency_center_id = p_competency_center_id)
      AND (p_site_id IS NULL OR pe.site_id = p_site_id)
      AND (p_job_level_id IS NULL OR pe.job_level_id = p_job_level_id)
      AND (
          p_name IS NULL OR trim(p_name) = ''
          OR pe.first_name ILIKE '%' || p_name || '%'
          OR pe.last_name ILIKE '%' || p_name || '%'
          OR pe.employee_id ILIKE '%' || p_name || '%'
          OR CONCAT(pe.first_name, ' ', pe.last_name) ILIKE '%' || p_name || '%'
      )
      AND (
          v_mode = 'everyone'
          OR (
              v_mode = 'complete'
              AND util.avg_availability * person_daily_capacity_hours(pe.weekly_hours, pe.fte)
                  >= COALESCE(p_required_hours, 8)
          )
          OR (
              v_mode = 'partial'
              AND util.avg_availability > 0
              AND util.avg_availability * person_daily_capacity_hours(pe.weekly_hours, pe.fte)
                  < COALESCE(p_required_hours, 8)
          )
      )
    ORDER BY pe.last_name, pe.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION person_period_utilization(UUID, DATE, DATE)
    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION person_utilization_search(
    DATE, DATE, TEXT, NUMERIC, UUID, UUID, UUID, UUID, UUID, TEXT
) TO anon, authenticated, service_role;
