-- V13__Add_excel_import_columns_and_master_data.sql
-- Add new columns to existing tables based on Excel imports
-- Seed master data from PSP_Master and EmplMaster sheets

-- ============================================================
-- EXTEND: Person Table with New Columns
-- ============================================================
ALTER TABLE person 
    ADD COLUMN IF NOT EXISTS cost_center TEXT,
    ADD COLUMN IF NOT EXISTS band TEXT,
    ADD COLUMN IF NOT EXISTS dob DATE,
    ADD COLUMN IF NOT EXISTS skills TEXT,
    ADD COLUMN IF NOT EXISTS business_unit TEXT;

-- ============================================================
-- EXTEND: Project Table with New Columns
-- ============================================================
ALTER TABLE project
    ADD COLUMN IF NOT EXISTS billable_type billable_type DEFAULT 'Billable' NOT NULL,
    ADD COLUMN IF NOT EXISTS practice_area_id UUID REFERENCES practice_area(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS client_name TEXT,
    ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT 'Active',
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS delivery_model TEXT,
    ADD COLUMN IF NOT EXISTS industry TEXT,
    ADD COLUMN IF NOT EXISTS engagement_type TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================================
-- NOTE: Master data is created dynamically during import
-- ============================================================
-- Consulting units, sites, market units, practice areas, and
-- competency centers are auto-created by the import service
-- when uploading persons/projects if they don't already exist.
-- No seed data is required for fresh database deployment.

-- ============================================================
-- PERMISSIONS
-- ============================================================
GRANT SELECT ON job_level TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_level TO authenticated, service_role;
