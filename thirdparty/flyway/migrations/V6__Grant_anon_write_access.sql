-- Single-tenant dev: allow unauthenticated PostgREST writes until UI auth is wired.
-- Requests without a JWT run as the anon role (see set_authenticated_role).
GRANT INSERT, UPDATE, DELETE ON
    market_unit,
    consulting_unit,
    practice_area,
    competency_center,
    site,
    project,
    person,
    project_filter,
    person_filter,
    request,
    schedule,
    vacation
TO anon;
