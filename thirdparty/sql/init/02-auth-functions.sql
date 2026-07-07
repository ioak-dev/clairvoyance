-- Create auth utility functions
-- These functions help extract user information from JWT claims

CREATE OR REPLACE FUNCTION auth.user_id() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    (current_setting('request.jwt.claims', true)::json ->> 'user_id')::text
  )
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.email() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json ->> 'email'
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.username() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json ->> 'preferred_username'
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.user_roles() RETURNS json AS $$
  SELECT current_setting('request.jwt.claims', true)::json -> 'resource_access' -> 'axion' -> 'roles'
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.has_role(role_name TEXT) RETURNS BOOLEAN AS $$
  SELECT role_name = ANY(
    SELECT json_array_elements_text(
      current_setting('request.jwt.claims', true)::json -> 'resource_access' -> 'axion' -> 'roles'
    )
  )
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
  SELECT CASE 
    WHEN current_setting('request.jwt.claims', true) IS NOT NULL 
    AND current_setting('request.jwt.claims', true) != ''
    THEN 'authenticated'
    ELSE 'anon'
  END
$$ LANGUAGE SQL STABLE;
