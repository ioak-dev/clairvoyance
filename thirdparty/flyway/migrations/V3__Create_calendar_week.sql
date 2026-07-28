CREATE TABLE calendar_week (
    iso_year   SMALLINT NOT NULL,
    iso_week   SMALLINT NOT NULL CHECK (iso_week BETWEEN 1 AND 53),
    week_start DATE NOT NULL,
    week_end   DATE NOT NULL,
    PRIMARY KEY (iso_year, iso_week),
    UNIQUE (week_start),
    CONSTRAINT calendar_week_range CHECK (week_end = week_start + 6)
);

-- Seed ISO weeks 2020–2035 from every Monday in range.
INSERT INTO calendar_week (iso_year, iso_week, week_start, week_end)
SELECT DISTINCT
    EXTRACT(ISOYEAR FROM week_start)::SMALLINT,
    EXTRACT(WEEK FROM week_start)::SMALLINT,
    week_start,
    week_start + 6
FROM (
    SELECT d::date AS week_start
    FROM generate_series('2019-12-30'::date, '2035-12-31'::date, '7 days'::interval) AS d
) weeks
WHERE EXTRACT(ISOYEAR FROM week_start) BETWEEN 2020 AND 2035
ON CONFLICT DO NOTHING;

GRANT SELECT ON calendar_week TO anon, authenticated, service_role;
