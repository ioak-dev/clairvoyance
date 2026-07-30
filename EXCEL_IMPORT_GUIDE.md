# Excel Data Import - Implementation Guide

## 📋 Overview

This guide provides step-by-step instructions to:
1. Run the Flyway database migration (V13) to add new columns and seed master data
2. Set up the Node.js API with separate Excel import endpoints for persons and projects
3. Use Postman to upload and import data

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose (for database)
- Node.js 18+ with npm
- Postman (optional, but recommended)

### Step 1: Run Database Migration

```bash
cd /Users/arun/projects/workspace/win/clairvoyance/thirdparty

# Start database and run migrations
docker compose down -v
docker compose up -d
cd flyway && ./migrate.sh dev
```

**What this does:**
- ✅ Creates `job_level` master table
- ✅ Adds new columns to `person` table: cost_center, band, dob, job_level_id, skills, business_unit
- ✅ Adds new columns to `project` table: client_name, project_status, start_date, end_date, delivery_model, industry, engagement_type, description
- ✅ Seeds master data: job levels, consulting units, sites, market units, practice areas, competency centers

**Expected output in migration logs:**
```
Migration V13__Add_excel_import_columns_and_master_data.sql ... OK (timing)
```

---

### Step 2: Install Dependencies & Start Node.js Server

```bash
cd /Users/arun/projects/workspace/win/clairvoyance/node

# Install npm dependencies (this adds multer and xlsx packages)
npm install

# Start the development server
npm run dev
```

**Expected output:**
```
Server running on port 3000
Connected to database
```

---

### Step 3: Import Data via Postman

#### Option A: Use Postman Collection (Recommended)

1. **Import the collection:**
   - Open Postman
   - Click `File` → `Import`
   - Select: `/Users/arun/projects/workspace/win/clairvoyance/Clairvoyance_Excel_Import.postman_collection.json`

2. **Configure environment variable:**
   - In Postman top-right, click the environment selector
   - Create new environment or edit existing
   - Set variable: `baseUrl = http://localhost:3000`

3. **Import Persons (Optional - if you have EmplMaster data):**
   - Click on `Import Persons (EmplMaster)` request
   - In the Body tab, click the file field
   - Select your Excel file with EmplMaster sheet
   - Click `Send`

4. **Import Projects (Optional - if you have PSP_Master data):**
   - Click on `Import Projects (PSP_Master)` request
   - In the Body tab, click the file field
   - Select your Excel file with PSP_Master sheet
   - Click `Send`

5. **View response:**
   - Success response example:
     ```json
     {
       "status": "success",
       "count": 250,
       "errors": []
     }
     ```

#### Option B: Manual cURL Commands

```bash
# Import persons from EmplMaster sheet
curl -X POST http://localhost:3000/api/import/persons \
  -F "file=@/path/to/excel_file.xlsx"

# Import projects from PSP_Master sheet
curl -X POST http://localhost:3000/api/import/projects \
  -F "file=@/path/to/excel_file.xlsx"
```

---

## 📊 Excel File Format Requirements

Your Excel file should have the following sheets:

### Sheet: `PSP_Master` (Projects) - Optional
| Column | Required | Type | Notes |
|--------|----------|------|-------|
| Project ID | Yes | Text | Unique project identifier |
| Reference ID | No | Text | External reference (defaults to Project ID) |
| Project Name | Yes | Text | Project name |
| Client Name | No | Text | Client/Customer name |
| Consulting Unit | No | Text | Must match predefined consulting units |
| Market Unit | No | Text | Enterprise, Mid-Market, SMB, Startup |
| Win Probability | No | Number | 0-100 percentage |
| Project Status | No | Text | Active, Completed, On Hold, etc. |
| Start Date | No | Date | YYYY-MM-DD format |
| End Date | No | Date | YYYY-MM-DD format |
| Delivery Model | No | Text | Onsite, Remote, Hybrid, etc. |
| Industry | No | Text | Industry vertical |
| Engagement Type | No | Text | Project, Ad-hoc, Retainer, etc. |
| Description | No | Text | Project description |

### Sheet: `EmplMaster` (Persons) - Optional
| Column | Required | Type | Notes |
|--------|----------|------|-------|
| Employee ID | Yes | Text | Unique employee identifier |
| First Name | Yes | Text | Employee first name |
| Last Name | Yes | Text | Employee last name |
| Email | Yes | Text | Unique email address |
| Start Date | No | Date | Employee start date |
| DOB / Date of Birth | No | Date | Date of birth |
| Gender | No | Text | Male, Female, Other |
| Consulting Unit | No | Text | Must match predefined consulting units |
| Site / Location | No | Text | Must match predefined sites |
| Practice Area | No | Text | Digital Transformation, Cloud Services, etc. |
| Job Level / Category | No | Text | L0-L5, D0-D5, B0 |
| Band | No | Text | Pay band or grade |
| FTE | No | Number | Full-time equivalent (0.0-1.0) |
| Weekly Hours | No | Number | Average weekly hours |
| Global Designation | No | Text | Global job title |
| Cost Center | No | Text | Cost center code |
| Skills | No | Text | Comma-separated skills |
| Business Unit | No | Text | Business unit assignment |

---

## 🔑 Predefined Master Data

Master data is seeded during migration V13 and **cannot be changed from Excel**. To modify, update the migration script or add seed data directly to database.

### Consulting Units
- Strategy & Transformation
- Technology
- Operations
- Finance & Risk
- Human Capital
- Marketing & Growth

### Sites
- New York
- San Francisco
- London
- India - Bangalore
- India - Hyderabad
- Singapore
- Tokyo

### Market Units
- Enterprise
- Mid-Market
- SMB
- Startup

### Job Levels
- L0, L1, L2, L3, L4, L5 (Staff levels)
- D0, D1, D2, D3, D4, D5 (Director levels)
- B0 (Fresher/Entry level)

### Practice Areas
- Digital Transformation
- Cloud Services
- Data & Analytics
- Enterprise Architecture
- Change Management
- Process Optimization

---

## ⚙️ Data Import Logic

### Processing Flow
1. **Validation**: Check required columns and formats
2. **FK Resolution**: Resolve consulting units, sites, job levels, etc. (case-insensitive)
3. **Insert/Update**: 
   - Persons: Upsert on `employee_id` (updates if exists)
   - Projects: Upsert on `project_id` (updates if exists)
4. **Error Handling**: Row errors logged but processing continues
5. **Transaction**: All data in single transaction, rollback on critical errors

### Foreign Key Resolution
- Consulting Unit names are case-insensitive
- Site names are case-insensitive
- Job Level codes are case-insensitive
- Unmatched references are set to NULL (not required)

### Data Validation
- ✅ Required fields checked before insert
- ✅ Email format validated
- ✅ Date format converted to ISO 8601
- ✅ Numeric fields parsed correctly
- ✅ FK references validated
- ✅ Unique constraints enforced
- ✅ Transaction rolled back on critical error

---

## 🔍 Verify Import Success

### Method 1: Check API Response
The Postman response will show:
```json
{
  "status": "success",
  "count": 250,
  "errors": []
}
```

### Method 2: Query Database

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d clairvoyance

# Check imported data
SELECT COUNT(*) as person_count FROM person;
SELECT COUNT(*) as project_count FROM project;
SELECT COUNT(*) as consulting_unit_count FROM consulting_unit;
SELECT COUNT(*) as job_level_count FROM job_level;

# Sample data
SELECT id, employee_id, first_name, last_name, email, job_level_id FROM person LIMIT 5;
SELECT id, project_id, name, client_name FROM project LIMIT 5;
```

### Method 3: Check API Logs
```bash
# If running with npm run dev, logs will appear in the terminal
# Look for successful database operations
```

---

## 🚨 Troubleshooting

### Issue: "xlsx module not found"
**Solution:**
```bash
cd /Users/arun/projects/workspace/win/clairvoyance/node
npm install xlsx multer
```

### Issue: "Port 3000 already in use"
**Solution:**
```bash
# Kill the existing process
lsof -i :3000
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

### Issue: Database connection failed
**Solution:**
```bash
# Verify Docker containers are running
docker ps

# Check database logs
docker logs <postgres_container_id>

# Verify database is up
psql -h localhost -U postgres -c "SELECT 1"
```

### Issue: "duplicate key value violates unique constraint"
**Solution:**
- Clean and restart database: `docker compose down -v && docker compose up -d`
- Or modify Excel to use unique employee_ids/project_ids
- Or use UPDATE endpoint to modify existing records

### Issue: Foreign key references not resolving (NULL values)
**Solution:**
- Verify Consulting Unit/Site names in Excel match predefined list (case-insensitive)
- Check for extra spaces or typos in names
- Add missing master data to database directly if needed

### Issue: "Excel file must contain EmplMaster sheet"
**Solution:**
- Endpoint `/api/import/persons` requires an "EmplMaster" sheet in the Excel file
- If you only have projects, use `/api/import/projects` endpoint instead

---

## 📝 Column Mapping Reference

### New Columns Added to `person` Table
- `cost_center` (TEXT) - Cost center code
- `band` (TEXT) - Pay band or grade
- `dob` (DATE) - Date of birth
- `job_level_id` (UUID FK) - Reference to job_level table
- `skills` (TEXT) - Comma-separated skills
- `business_unit` (TEXT) - Business unit assignment

### New Columns Added to `project` Table
- `client_name` (TEXT) - Client/customer name
- `project_status` (TEXT) - Project status
- `start_date` (DATE) - Project start date
- `end_date` (DATE) - Project end date
- `delivery_model` (TEXT) - Delivery model type
- `industry` (TEXT) - Industry vertical
- `engagement_type` (TEXT) - Type of engagement
- `description` (TEXT) - Project description

### New Master Table Created
- `job_level` (id, level_code, level_name, band, created_at, updated_at)

---

## 🎯 Next Steps

1. ✅ Run Flyway migration (V13) - creates schema & seeds master data
2. ✅ Start Node.js server - starts import endpoints
3. ✅ Upload Excel via Postman - imports persons/projects
4. ✅ Verify data in database - confirm success
5. ⏭️ Build UI views to display imported data
6. ⏭️ Create filtering/reporting on new fields

---

## 📞 Support

For issues or questions:
1. Check the **Troubleshooting** section above
2. Review API response errors for specific row/field issues
3. Verify Excel file format matches requirements
4. Check database logs: `docker logs <postgres_container_id>`
5. Check API logs: Terminal where `npm run dev` is running

---

**Last Updated:** 2026-07-29
