CREATE OR REPLACE FUNCTION seed_uuid(seed text)
RETURNS uuid AS $$
  SELECT (
    substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 13, 3) ||
    '-a' || substr(h, 17, 3) || '-' || substr(h, 21, 12)
  )::uuid
  FROM (SELECT md5('clairvoyance:' || seed) AS h) s;
$$ LANGUAGE sql IMMUTABLE;

INSERT INTO market_unit (id, name)
VALUES
  (seed_uuid('mu-global'), 'Global'),
  (seed_uuid('mu-us'), 'US'),
  (seed_uuid('mu-apac'), 'APAC'),
  (seed_uuid('mu-europe'), 'Europe')
ON CONFLICT (name) DO NOTHING;

INSERT INTO consulting_unit (id, name)
VALUES
  (seed_uuid('cu-enterprise'), 'Enterprise Apps'),
  (seed_uuid('cu-sap'), 'SAP'),
  (seed_uuid('cu-healthcare'), 'Healthcare'),
  (seed_uuid('cu-internal'), 'Internal'),
  (seed_uuid('cu-crm'), 'CRM')
ON CONFLICT (name) DO NOTHING;

INSERT INTO practice_area (id, name)
VALUES
  (seed_uuid('pa-digital'), 'Digital'),
  (seed_uuid('pa-sap'), 'SAP'),
  (seed_uuid('pa-design'), 'Design'),
  (seed_uuid('pa-delivery'), 'Delivery'),
  (seed_uuid('pa-engineering'), 'Engineering')
ON CONFLICT (name) DO NOTHING;

INSERT INTO competency_center (id, practice_area_id, name)
VALUES
  (seed_uuid('cc-frontend'), seed_uuid('pa-digital'), 'Frontend Development'),
  (seed_uuid('cc-sap-fico'), seed_uuid('pa-sap'), 'SAP FICO'),
  (seed_uuid('cc-uiux'), seed_uuid('pa-design'), 'UI/UX Design'),
  (seed_uuid('cc-pm'), seed_uuid('pa-delivery'), 'Project Management'),
  (seed_uuid('cc-backend'), seed_uuid('pa-engineering'), 'Backend Development')
ON CONFLICT (practice_area_id, name) DO NOTHING;

INSERT INTO site (id, name)
VALUES
  (seed_uuid('site-bangalore'), 'Bangalore'),
  (seed_uuid('site-london'), 'London'),
  (seed_uuid('site-pune'), 'Pune'),
  (seed_uuid('site-newyork'), 'New York'),
  (seed_uuid('site-remote'), 'Remote')
ON CONFLICT (name) DO NOTHING;

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
    NULL, 'Full Time', 'L2', 1.00, 40.00, 'Senior Consultant', 'Senior Consultant'
  ),
  (
    seed_uuid('res-2'), 'EMP-1002', 'Bob', 'Smith', 'bob.smith@example.com',
    '2021-01-15', 'Male', 'Active',
    seed_uuid('cu-sap'), seed_uuid('pa-sap'), seed_uuid('cc-sap-fico'),
    'Employed', seed_uuid('site-london'), NULL,
    NULL, 'Full Time', 'L3', 1.00, 40.00, 'Manager', 'Manager'
  ),
  (
    seed_uuid('res-3'), 'EMP-1003', 'Carol', 'Davis', 'carol.davis@example.com',
    '2023-06-01', 'Female', 'Active',
    seed_uuid('cu-enterprise'), seed_uuid('pa-design'), seed_uuid('cc-uiux'),
    'Employed', seed_uuid('site-pune'), seed_uuid('res-2'),
    NULL, 'Full Time', 'L1', 1.00, 40.00, 'Consultant', 'Consultant'
  ),
  (
    seed_uuid('res-4'), 'EMP-1004', 'Daniel', 'Miller', 'daniel.miller@example.com',
    '2020-09-01', 'Male', 'Active',
    seed_uuid('cu-healthcare'), seed_uuid('pa-delivery'), seed_uuid('cc-pm'),
    'Employed', seed_uuid('site-newyork'), seed_uuid('res-2'),
    NULL, 'Full Time', 'L3', 1.00, 40.00, 'Manager', 'Manager'
  ),
  (
    seed_uuid('res-5'), 'EMP-1005', 'Eva', 'Wilson', 'eva.wilson@example.com',
    '2024-02-01', 'Female', 'Active',
    seed_uuid('cu-sap'), seed_uuid('pa-engineering'), seed_uuid('cc-backend'),
    'Employed', seed_uuid('site-remote'), seed_uuid('res-2'),
    NULL, 'Contractor', 'L2', 0.80, 32.00, 'Senior Consultant', 'Senior Consultant'
  )
ON CONFLICT (employee_id) DO NOTHING;

INSERT INTO project (id, reference_id, project_id, name, manager_id, market_unit_id, consulting_unit_id, win_probability)
VALUES
  (seed_uuid('proj-tms'), 'NW-PROJ-001', 'PRJ-PHOENIX', 'Phoenix Platform', seed_uuid('res-2'), seed_uuid('mu-global'), seed_uuid('cu-enterprise'), 100.00),
  (seed_uuid('proj-s4hana'), 'NW-PROJ-002', 'PRJ-ATLAS', 'Atlas Migration', seed_uuid('res-2'), seed_uuid('mu-global'), seed_uuid('cu-sap'), 100.00),
  (seed_uuid('proj-solventum'), 'NW-PROJ-003', 'PRJ-HORIZON', 'Horizon Analytics', seed_uuid('res-4'), seed_uuid('mu-us'), seed_uuid('cu-healthcare'), 100.00),
  (seed_uuid('proj-internal'), 'NW-PROJ-004', 'PRJ-SUPPORT', 'Internal Support Desk', seed_uuid('res-2'), seed_uuid('mu-global'), seed_uuid('cu-internal'), 100.00),
  (seed_uuid('proj-opp-honda'), 'NW-PROJ-005', 'PRJ-SUMMIT', 'Summit CRM Opportunity', seed_uuid('res-4'), seed_uuid('mu-apac'), seed_uuid('cu-crm'), 35.00)
ON CONFLICT (project_id) DO NOTHING;

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

-- Request headers
INSERT INTO request (
    id, reference_id, project_id, person_id, billable_type, booking_type,
    probability, status, required_skill, notes,
    consulting_unit_id, practice_area_id, competency_center_id, site_id, job_category
)
VALUES
  (
    seed_uuid('req-1'), 'NW-REQ-001', seed_uuid('proj-solventum'), NULL, 'Billable', 'hard',
    100, 'Pending', 'Backend Developer', 'Urgent cover needed for Horizon Analytics backend implementation phase.',
    seed_uuid('cu-healthcare'), seed_uuid('pa-engineering'), seed_uuid('cc-backend'), seed_uuid('site-bangalore'), 'L2'
  ),
  (
    seed_uuid('req-2'), 'NW-REQ-002', seed_uuid('proj-internal'), NULL, 'Opportunity', 'soft',
    60, 'Pending', 'React', 'Support with onboarding of junior staff.',
    seed_uuid('cu-enterprise'), seed_uuid('pa-digital'), seed_uuid('cc-frontend'), seed_uuid('site-bangalore'), 'L1'
  ),
  (
    seed_uuid('req-3'), 'NW-REQ-003', seed_uuid('proj-s4hana'), NULL, 'Billable', 'hard',
    100, 'Pending', 'SAP Specialist', 'SAP consultant to support migration phase.',
    seed_uuid('cu-sap'), seed_uuid('pa-sap'), seed_uuid('cc-sap-fico'), seed_uuid('site-london'), 'L3'
  ),
  (
    seed_uuid('req-4'), 'NW-REQ-004', seed_uuid('proj-tms'), NULL, 'Billable', 'hard',
    100, 'Pending', 'UI/UX Design', 'UI expert to design new dashboards.',
    seed_uuid('cu-enterprise'), seed_uuid('pa-design'), seed_uuid('cc-uiux'), seed_uuid('site-pune'), 'L1'
  ),
  (
    seed_uuid('req-5'), 'NW-REQ-005', seed_uuid('proj-opp-honda'), NULL, 'Opportunity', 'soft',
    75, 'Pending', 'Figma', 'Urgent CRM proposal design support.',
    seed_uuid('cu-crm'), seed_uuid('pa-design'), seed_uuid('cc-uiux'), seed_uuid('site-pune'), 'L1'
  ),
  (
    seed_uuid('req-6'), 'NW-REQ-006', seed_uuid('proj-solventum'), NULL, 'Billable', 'hard',
    100, 'Pending', 'QA Engineer', 'Quality Assurance checking of deployment candidates.',
    seed_uuid('cu-healthcare'), seed_uuid('pa-delivery'), seed_uuid('cc-pm'), seed_uuid('site-newyork'), 'L2'
  )
ON CONFLICT (id) DO NOTHING;

-- Request weeks (ISO 2026 weeks 24–28)
INSERT INTO request_week (request_id, iso_year, iso_week, days_per_week)
VALUES
  -- req-1: W27–W28 @ 4 days
  (seed_uuid('req-1'), 2026, 27, 4), (seed_uuid('req-1'), 2026, 28, 4),
  -- req-2: W27–W28 @ 1 day
  (seed_uuid('req-2'), 2026, 27, 1), (seed_uuid('req-2'), 2026, 28, 1),
  -- req-3: W25–W27 @ 5 days
  (seed_uuid('req-3'), 2026, 25, 5), (seed_uuid('req-3'), 2026, 26, 5), (seed_uuid('req-3'), 2026, 27, 5),
  -- req-4: W24–W26 @ 3 days
  (seed_uuid('req-4'), 2026, 24, 3), (seed_uuid('req-4'), 2026, 25, 3), (seed_uuid('req-4'), 2026, 26, 3),
  -- req-5: W26–W27 @ 5 days
  (seed_uuid('req-5'), 2026, 26, 5), (seed_uuid('req-5'), 2026, 27, 5),
  -- req-6: W25–W26 @ 2 days
  (seed_uuid('req-6'), 2026, 25, 2), (seed_uuid('req-6'), 2026, 26, 2)
ON CONFLICT DO NOTHING;

-- Schedule headers (one per assignment)
INSERT INTO schedule (id, project_id, person_id, request_id, billable_type, booking_type)
VALUES
  (seed_uuid('sched-alice-tms'), seed_uuid('proj-tms'), seed_uuid('res-1'), NULL, 'Billable', 'hard'),
  (seed_uuid('sched-bob-s4'), seed_uuid('proj-s4hana'), seed_uuid('res-2'), seed_uuid('req-3'), 'Billable', 'hard'),
  (seed_uuid('sched-bob-solv'), seed_uuid('proj-solventum'), seed_uuid('res-2'), seed_uuid('req-1'), 'Billable', 'hard'),
  (seed_uuid('sched-bob-tms'), seed_uuid('proj-tms'), seed_uuid('res-2'), NULL, 'Billable', 'hard'),
  (seed_uuid('sched-eva-s4'), seed_uuid('proj-s4hana'), seed_uuid('res-5'), seed_uuid('req-3'), 'Billable', 'hard'),
  (seed_uuid('sched-eva-tms'), seed_uuid('proj-tms'), seed_uuid('res-5'), NULL, 'Opportunity', 'soft'),
  (seed_uuid('sched-dan-solv'), seed_uuid('proj-solventum'), seed_uuid('res-4'), NULL, 'Billable', 'hard'),
  (seed_uuid('sched-carol-opp'), seed_uuid('proj-opp-honda'), seed_uuid('res-3'), NULL, 'Billable', 'hard')
ON CONFLICT (id) DO NOTHING;

INSERT INTO schedule_week (schedule_id, person_id, project_id, iso_year, iso_week, days_per_week)
VALUES
  -- Alice on Phoenix: W23–W28 @ 2 days
  (seed_uuid('sched-alice-tms'), seed_uuid('res-1'), seed_uuid('proj-tms'), 2026, 23, 2),
  (seed_uuid('sched-alice-tms'), seed_uuid('res-1'), seed_uuid('proj-tms'), 2026, 24, 2),
  (seed_uuid('sched-alice-tms'), seed_uuid('res-1'), seed_uuid('proj-tms'), 2026, 25, 2),
  (seed_uuid('sched-alice-tms'), seed_uuid('res-1'), seed_uuid('proj-tms'), 2026, 26, 2),
  (seed_uuid('sched-alice-tms'), seed_uuid('res-1'), seed_uuid('proj-tms'), 2026, 27, 2),
  (seed_uuid('sched-alice-tms'), seed_uuid('res-1'), seed_uuid('proj-tms'), 2026, 28, 2),
  -- Bob on Atlas: W24–W28 @ 4 days
  (seed_uuid('sched-bob-s4'), seed_uuid('res-2'), seed_uuid('proj-s4hana'), 2026, 24, 4),
  (seed_uuid('sched-bob-s4'), seed_uuid('res-2'), seed_uuid('proj-s4hana'), 2026, 25, 4),
  (seed_uuid('sched-bob-s4'), seed_uuid('res-2'), seed_uuid('proj-s4hana'), 2026, 26, 4),
  (seed_uuid('sched-bob-s4'), seed_uuid('res-2'), seed_uuid('proj-s4hana'), 2026, 27, 4),
  (seed_uuid('sched-bob-s4'), seed_uuid('res-2'), seed_uuid('proj-s4hana'), 2026, 28, 4),
  -- Bob on Horizon: W26–W28 @ 3 days
  (seed_uuid('sched-bob-solv'), seed_uuid('res-2'), seed_uuid('proj-solventum'), 2026, 26, 3),
  (seed_uuid('sched-bob-solv'), seed_uuid('res-2'), seed_uuid('proj-solventum'), 2026, 27, 3),
  (seed_uuid('sched-bob-solv'), seed_uuid('res-2'), seed_uuid('proj-solventum'), 2026, 28, 3),
  -- Bob on Phoenix: W23–W25 @ 3 days
  (seed_uuid('sched-bob-tms'), seed_uuid('res-2'), seed_uuid('proj-tms'), 2026, 23, 3),
  (seed_uuid('sched-bob-tms'), seed_uuid('res-2'), seed_uuid('proj-tms'), 2026, 24, 3),
  (seed_uuid('sched-bob-tms'), seed_uuid('res-2'), seed_uuid('proj-tms'), 2026, 25, 3),
  -- Eva on Atlas: W23–W26 @ 4 days
  (seed_uuid('sched-eva-s4'), seed_uuid('res-5'), seed_uuid('proj-s4hana'), 2026, 23, 4),
  (seed_uuid('sched-eva-s4'), seed_uuid('res-5'), seed_uuid('proj-s4hana'), 2026, 24, 4),
  (seed_uuid('sched-eva-s4'), seed_uuid('res-5'), seed_uuid('proj-s4hana'), 2026, 25, 4),
  (seed_uuid('sched-eva-s4'), seed_uuid('res-5'), seed_uuid('proj-s4hana'), 2026, 26, 4),
  -- Eva on Phoenix: W27–W28 @ 1 day (opportunity)
  (seed_uuid('sched-eva-tms'), seed_uuid('res-5'), seed_uuid('proj-tms'), 2026, 27, 1),
  (seed_uuid('sched-eva-tms'), seed_uuid('res-5'), seed_uuid('proj-tms'), 2026, 28, 1),
  -- Daniel on Horizon: W26–W28 @ 4 days
  (seed_uuid('sched-dan-solv'), seed_uuid('res-4'), seed_uuid('proj-solventum'), 2026, 26, 4),
  (seed_uuid('sched-dan-solv'), seed_uuid('res-4'), seed_uuid('proj-solventum'), 2026, 27, 4),
  (seed_uuid('sched-dan-solv'), seed_uuid('res-4'), seed_uuid('proj-solventum'), 2026, 28, 4),
  -- Carol on Summit opp: W23–W26 @ 5 days
  (seed_uuid('sched-carol-opp'), seed_uuid('res-3'), seed_uuid('proj-opp-honda'), 2026, 23, 5),
  (seed_uuid('sched-carol-opp'), seed_uuid('res-3'), seed_uuid('proj-opp-honda'), 2026, 24, 5),
  (seed_uuid('sched-carol-opp'), seed_uuid('res-3'), seed_uuid('proj-opp-honda'), 2026, 25, 5),
  (seed_uuid('sched-carol-opp'), seed_uuid('res-3'), seed_uuid('proj-opp-honda'), 2026, 26, 5)
ON CONFLICT DO NOTHING;

INSERT INTO vacation (id, person_id, start_date, end_date, status, reason)
VALUES
  (seed_uuid('vac-1'), seed_uuid('res-3'), '2026-06-22', '2026-06-26', 'Approved', 'Summer Trip to Europe'),
  (seed_uuid('vac-2'), seed_uuid('res-1'), '2026-07-10', '2026-07-14', 'Pending', 'Family wedding'),
  (seed_uuid('vac-3'), seed_uuid('res-5'), '2026-07-01', '2026-07-03', 'Pending', 'Medical appointment checkup')
ON CONFLICT (id) DO NOTHING;

DROP FUNCTION seed_uuid(text);
