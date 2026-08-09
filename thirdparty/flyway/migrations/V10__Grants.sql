-- Single-tenant dev: allow unauthenticated PostgREST writes until UI auth is wired.
GRANT INSERT, UPDATE, DELETE ON
    market_unit, consulting_unit, practice_area, competency_center, site, job_level,
    project, person, project_filter, person_filter, request_filter,
    request, schedule, vacation, simulation_log
TO anon;

GRANT INSERT ON simulation_log TO anon;

NOTIFY pgrst, 'reload schema';
