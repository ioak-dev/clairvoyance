-- Preserve fractional schedule allocation in utilization calculations.

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
        SELECT cw.iso_year, cw.iso_week
        FROM calendar_week cw
        WHERE cw.week_start <= p_to
          AND cw.week_end >= p_from
        ORDER BY cw.iso_year, cw.iso_week
    ),
    weekly_totals AS (
        SELECT
            w.iso_year,
            w.iso_week,
            COALESCE((
                SELECT SUM(sw.days_per_week)::NUMERIC
                FROM schedule_week sw
                WHERE sw.person_id = p_person_id
                  AND sw.iso_year = w.iso_year
                  AND sw.iso_week = w.iso_week
            ), 0::NUMERIC) AS allocated_days
        FROM weeks_in_range w
    )
    SELECT
        (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'iso_year', wt.iso_year,
                    'iso_week', wt.iso_week,
                    'utilization', ROUND(wt.allocated_days, 2)
                )
                ORDER BY wt.iso_year, wt.iso_week
            ), '[]'::jsonb)
            FROM weekly_totals wt
        ),
        (SELECT ROUND(AVG(wt.allocated_days)::NUMERIC, 2) FROM weekly_totals wt),
        (SELECT ROUND(AVG(GREATEST(0::NUMERIC, 5::NUMERIC - wt.allocated_days))::NUMERIC, 2) FROM weekly_totals wt);
$$;

GRANT EXECUTE ON FUNCTION person_period_utilization(UUID, DATE, DATE)
    TO anon, authenticated, service_role;
