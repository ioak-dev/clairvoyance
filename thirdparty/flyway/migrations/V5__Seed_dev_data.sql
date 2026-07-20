-- Deterministic UUID helper for idempotent seed data
CREATE OR REPLACE FUNCTION seed_uuid(seed text)
RETURNS uuid AS $$
  SELECT (
    substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 13, 3) ||
    '-a' || substr(h, 17, 3) || '-' || substr(h, 21, 12)
  )::uuid
  FROM (SELECT md5('clairvoyance:' || seed) AS h) s;
$$ LANGUAGE sql IMMUTABLE;

-- Lookup: market units
INSERT INTO market_unit (id, name)
VALUES
  (seed_uuid('mu-global'), 'Global'),
  (seed_uuid('mu-us'), 'US'),
  (seed_uuid('mu-apac'), 'APAC'),
  (seed_uuid('mu-europe'), 'Europe')
ON CONFLICT (name) DO NOTHING;

-- Lookup: consulting units
INSERT INTO consulting_unit (id, name)
VALUES
  (seed_uuid('cu-enterprise'), 'Enterprise Apps'),
  (seed_uuid('cu-sap'), 'SAP'),
  (seed_uuid('cu-healthcare'), 'Healthcare'),
  (seed_uuid('cu-internal'), 'Internal'),
  (seed_uuid('cu-crm'), 'CRM')
ON CONFLICT (name) DO NOTHING;

-- Lookup: practice areas
INSERT INTO practice_area (id, name)
VALUES
  (seed_uuid('pa-digital'), 'Digital'),
  (seed_uuid('pa-sap'), 'SAP'),
  (seed_uuid('pa-design'), 'Design'),
  (seed_uuid('pa-delivery'), 'Delivery'),
  (seed_uuid('pa-engineering'), 'Engineering')
ON CONFLICT (name) DO NOTHING;

-- Lookup: competency centers
INSERT INTO competency_center (id, practice_area_id, name)
VALUES
  (seed_uuid('cc-frontend'), seed_uuid('pa-digital'), 'Frontend Development'),
  (seed_uuid('cc-sap-fico'), seed_uuid('pa-sap'), 'SAP FICO'),
  (seed_uuid('cc-uiux'), seed_uuid('pa-design'), 'UI/UX Design'),
  (seed_uuid('cc-pm'), seed_uuid('pa-delivery'), 'Project Management'),
  (seed_uuid('cc-backend'), seed_uuid('pa-engineering'), 'Backend Development')
ON CONFLICT (practice_area_id, name) DO NOTHING;

-- Lookup: sites
INSERT INTO site (id, name)
VALUES
  (seed_uuid('site-bangalore'), 'Bangalore'),
  (seed_uuid('site-london'), 'London'),
  (seed_uuid('site-pune'), 'Pune'),
  (seed_uuid('site-newyork'), 'New York'),
  (seed_uuid('site-remote'), 'Remote')
ON CONFLICT (name) DO NOTHING;

-- Persons
INSERT INTO person (
    id, employee_id, first_name, last_name, email,
    start_date, gender, status,
    consulting_unit_id, practice_area_id, competency_center_id,
    lifecycle_status, site_id, manager_id,
    termination_date, employment_type, job_category,
    fte, weekly_hours, global_designation, local_designation
)
VALUES
  (
    seed_uuid('res-1'), 'EMP-1001', 'Alice', 'Johnson', 'alice.johnson@example.com',
    '2022-04-01', 'Female', 'Active',
    seed_uuid('cu-enterprise'), seed_uuid('pa-digital'), seed_uuid('cc-frontend'),
    'Employed', seed_uuid('site-bangalore'), NULL,
    NULL, 'Full Time', 'L2',
    1.00, 40.00, 'Senior Consultant', 'Senior Consultant'
  ),
  (
    seed_uuid('res-2'), 'EMP-1002', 'Bob', 'Smith', 'bob.smith@example.com',
    '2021-01-15', 'Male', 'Active',
    seed_uuid('cu-sap'), seed_uuid('pa-sap'), seed_uuid('cc-sap-fico'),
    'Employed', seed_uuid('site-london'), NULL,
    NULL, 'Full Time', 'L3',
    1.00, 40.00, 'Manager', 'Manager'
  ),
  (
    seed_uuid('res-3'), 'EMP-1003', 'Carol', 'Davis', 'carol.davis@example.com',
    '2023-06-01', 'Female', 'Active',
    seed_uuid('cu-enterprise'), seed_uuid('pa-design'), seed_uuid('cc-uiux'),
    'Employed', seed_uuid('site-pune'), seed_uuid('res-2'),
    NULL, 'Full Time', 'L1',
    1.00, 40.00, 'Consultant', 'Consultant'
  ),
  (
    seed_uuid('res-4'), 'EMP-1004', 'Daniel', 'Miller', 'daniel.miller@example.com',
    '2020-09-01', 'Male', 'Active',
    seed_uuid('cu-healthcare'), seed_uuid('pa-delivery'), seed_uuid('cc-pm'),
    'Employed', seed_uuid('site-newyork'), seed_uuid('res-2'),
    NULL, 'Full Time', 'L3',
    1.00, 40.00, 'Manager', 'Manager'
  ),
  (
    seed_uuid('res-5'), 'EMP-1005', 'Eva', 'Wilson', 'eva.wilson@example.com',
    '2024-02-01', 'Female', 'Active',
    seed_uuid('cu-sap'), seed_uuid('pa-engineering'), seed_uuid('cc-backend'),
    'Employed', seed_uuid('site-remote'), seed_uuid('res-2'),
    NULL, 'Contractor', 'L2',
    0.80, 32.00, 'Senior Consultant', 'Senior Consultant'
  )
ON CONFLICT (employee_id) DO NOTHING;

-- Projects
INSERT INTO project (id, project_id, name, manager_id, market_unit_id, consulting_unit_id, win_probability)
VALUES
  (seed_uuid('proj-tms'), 'PRJ-PHOENIX', 'Phoenix Platform', seed_uuid('res-2'), seed_uuid('mu-global'), seed_uuid('cu-enterprise'), 100.00),
  (seed_uuid('proj-s4hana'), 'PRJ-ATLAS', 'Atlas Migration', seed_uuid('res-2'), seed_uuid('mu-global'), seed_uuid('cu-sap'), 100.00),
  (seed_uuid('proj-solventum'), 'PRJ-HORIZON', 'Horizon Analytics', seed_uuid('res-4'), seed_uuid('mu-us'), seed_uuid('cu-healthcare'), 100.00),
  (seed_uuid('proj-internal'), 'PRJ-SUPPORT', 'Internal Support Desk', seed_uuid('res-2'), seed_uuid('mu-global'), seed_uuid('cu-internal'), 100.00),
  (seed_uuid('proj-opp-honda'), 'PRJ-SUMMIT', 'Summit CRM Opportunity', seed_uuid('res-4'), seed_uuid('mu-apac'), seed_uuid('cu-crm'), 35.00)
ON CONFLICT (project_id) DO NOTHING;

-- Filters
INSERT INTO project_filter (id, name, description, criteria, sort_order)
VALUES
  (seed_uuid('pf-all'), 'All Projects', 'No project filter applied', '{}'::jsonb, 0),
  (seed_uuid('pf-enterprise'), 'Enterprise Apps', 'Projects in Enterprise Apps consulting unit', jsonb_build_object('consulting_unit_id', seed_uuid('cu-enterprise')::text), 1),
  (seed_uuid('pf-opportunities'), 'Opportunities Only', 'Projects with win probability below 100%', '{"win_probability_lt": 100}'::jsonb, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO person_filter (id, name, description, criteria, sort_order)
VALUES
  (seed_uuid('pf-person-all'), 'All People', 'No person filter applied', '{}'::jsonb, 0),
  (seed_uuid('pf-person-bangalore'), 'Bangalore Site', 'People based in Bangalore', jsonb_build_object('site_id', seed_uuid('site-bangalore')::text), 1),
  (seed_uuid('pf-person-employed'), 'Employed Only', 'People with Employed lifecycle status', '{"lifecycle_status": "Employed"}'::jsonb, 2)
ON CONFLICT (id) DO NOTHING;

-- Requests
INSERT INTO request (id, project_id, person_id, start_date, end_date, billable_percent, billable_type, status, required_skill, notes)
VALUES
  (seed_uuid('req-1'), seed_uuid('proj-solventum'), NULL, '2026-06-29', '2026-07-10', 80, 'Billable', 'Pending', 'Backend Developer', 'Urgent cover needed for Horizon Analytics backend implementation phase.'),
  (seed_uuid('req-2'), seed_uuid('proj-internal'), NULL, '2026-07-01', '2026-07-08', 20, 'Opportunity', 'Pending', 'React', 'Support with onboarding of junior staff.'),
  (seed_uuid('req-3'), seed_uuid('proj-s4hana'), NULL, '2026-06-15', '2026-06-30', 100, 'Billable', 'Pending', 'SAP Specialist', 'SAP consultant to support migration phase.'),
  (seed_uuid('req-4'), seed_uuid('proj-tms'), NULL, '2026-06-08', '2026-06-20', 50, 'Billable', 'Pending', 'UI/UX Design', 'UI expert to design new dashboards.'),
  (seed_uuid('req-5'), seed_uuid('proj-opp-honda'), NULL, '2026-06-22', '2026-07-03', 100, 'Opportunity', 'Pending', 'Figma', 'Urgent CRM proposal design support.'),
  (seed_uuid('req-6'), seed_uuid('proj-solventum'), NULL, '2026-06-15', '2026-06-26', 40, 'Billable', 'Pending', 'QA Engineer', 'Quality Assurance checking of deployment candidates.')
ON CONFLICT (id) DO NOTHING;

-- Schedules (from INITIAL_ALLOCATIONS)
INSERT INTO schedule (id, project_id, person_id, request_id, start_date, end_date, billable_percent, billable_type)
VALUES
  (seed_uuid('alloc-1'), seed_uuid('proj-tms'), seed_uuid('res-1'), NULL, '2026-06-01', '2026-06-12', 50, 'Billable'),
  (seed_uuid('alloc-2'), seed_uuid('proj-tms'), seed_uuid('res-1'), NULL, '2026-06-13', '2026-06-15', 50, 'Billable'),
  (seed_uuid('alloc-3'), seed_uuid('proj-tms'), seed_uuid('res-1'), NULL, '2026-06-18', '2026-07-05', 50, 'Billable'),
  (seed_uuid('alloc-4'), seed_uuid('proj-tms'), seed_uuid('res-1'), NULL, '2026-07-06', '2026-07-15', 50, 'Billable'),
  (seed_uuid('alloc-5'), seed_uuid('proj-s4hana'), seed_uuid('res-2'), NULL, '2026-06-03', '2026-06-05', 40, 'Billable'),
  (seed_uuid('alloc-6'), seed_uuid('proj-s4hana'), seed_uuid('res-2'), NULL, '2026-06-06', '2026-06-12', 70, 'Billable'),
  (seed_uuid('alloc-7'), seed_uuid('proj-s4hana'), seed_uuid('res-2'), NULL, '2026-06-13', '2026-06-25', 70, 'Billable'),
  (seed_uuid('alloc-7b'), seed_uuid('proj-s4hana'), seed_uuid('res-2'), NULL, '2026-06-26', '2026-07-15', 70, 'Billable'),
  (seed_uuid('alloc-8'), seed_uuid('proj-solventum'), seed_uuid('res-2'), NULL, '2026-06-13', '2026-06-17', 70, 'Billable'),
  (seed_uuid('alloc-9'), seed_uuid('proj-solventum'), seed_uuid('res-2'), NULL, '2026-06-18', '2026-07-10', 60, 'Billable'),
  (seed_uuid('alloc-10'), seed_uuid('proj-tms'), seed_uuid('res-2'), NULL, '2026-06-01', '2026-06-12', 70, 'Billable'),
  (seed_uuid('alloc-11'), seed_uuid('proj-tms'), seed_uuid('res-2'), NULL, '2026-06-13', '2026-06-17', 50, 'Billable'),
  (seed_uuid('alloc-12'), seed_uuid('proj-s4hana'), seed_uuid('res-5'), NULL, '2026-06-01', '2026-06-12', 70, 'Billable'),
  (seed_uuid('alloc-13'), seed_uuid('proj-s4hana'), seed_uuid('res-5'), NULL, '2026-06-13', '2026-06-17', 70, 'Billable'),
  (seed_uuid('alloc-14'), seed_uuid('proj-s4hana'), seed_uuid('res-5'), NULL, '2026-06-18', '2026-06-25', 70, 'Billable'),
  (seed_uuid('alloc-15'), seed_uuid('proj-tms'), seed_uuid('res-5'), NULL, '2026-06-26', '2026-07-10', 10, 'Opportunity'),
  (seed_uuid('alloc-16'), seed_uuid('proj-solventum'), seed_uuid('res-4'), NULL, '2026-06-18', '2026-07-05', 70, 'Billable'),
  (seed_uuid('alloc-17'), seed_uuid('proj-opp-honda'), seed_uuid('res-3'), NULL, '2026-06-01', '2026-06-19', 100, 'Billable')
ON CONFLICT (id) DO NOTHING;

-- Vacations
INSERT INTO vacation (id, person_id, start_date, end_date, status, reason)
VALUES
  (seed_uuid('vac-1'), seed_uuid('res-3'), '2026-06-22', '2026-06-26', 'Approved', 'Summer Trip to Europe'),
  (seed_uuid('vac-2'), seed_uuid('res-1'), '2026-07-10', '2026-07-14', 'Pending', 'Family wedding'),
  (seed_uuid('vac-3'), seed_uuid('res-5'), '2026-07-01', '2026-07-03', 'Pending', 'Medical appointment checkup')
ON CONFLICT (id) DO NOTHING;

DROP FUNCTION seed_uuid(text);
