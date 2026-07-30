import { Pool, PoolClient } from 'pg';
import XLSX from 'xlsx';
import { Request, Response } from 'express';
import { pool } from '../db/client';

interface ImportResult {
  status: 'success' | 'error';
  count: number;
  errors: string[];
}

/**
 * Convert an Excel cell value to an ISO date string (YYYY-MM-DD).
 * Excel stores dates as numeric serials (days since 1900-01-01).
 * XLSX.SSF.parse_date_code converts the serial to a date object.
 */
function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  // If it's already a string like "2024-07-01" or "01/07/2024", parse it
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  // If it's a number (Excel date serial), convert via XLSX
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const month = String(parsed.m).padStart(2, '0');
    const day = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${month}-${day}`;
  }

  // If it's already a Date object
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Get or create a master data entry. If the value doesn't exist in the master table,
 * it creates a new entry and returns the ID.
 */
async function getOrCreateMasterData(
  client: PoolClient,
  tableName: string,
  value: string | undefined,
  searchColumn: string = 'name'
): Promise<string | null> {
  if (!value) return null;

  const lowerValue = value.toLowerCase().trim();

  // First, try to find existing entry (case-insensitive)
  const result = await client.query(
    `SELECT id FROM ${tableName} WHERE LOWER(${searchColumn}) = $1`,
    [lowerValue]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Entry doesn't exist, create it
  const insertResult = await client.query(
    `INSERT INTO ${tableName} (${searchColumn}) VALUES ($1) RETURNING id`,
    [value.trim()]
  );

  return insertResult.rows[0].id;
}

/**
 * Get or create a job level. Job levels require both level_code and level_name.
 */
async function getOrCreateJobLevel(
  client: PoolClient,
  levelCode: string | undefined
): Promise<string | null> {
  if (!levelCode) return null;

  const trimmedCode = levelCode.toLowerCase().trim();

  // First, try to find existing job level
  const result = await client.query(
    `SELECT id FROM job_level WHERE LOWER(level_code) = $1`,
    [trimmedCode]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Job level doesn't exist, create it
  // Use level_code as level_name if not providing a separate description
  const insertResult = await client.query(
    `INSERT INTO job_level (level_code, level_name) VALUES ($1, $2) RETURNING id`,
    [levelCode.trim(), levelCode.trim()]
  );

  return insertResult.rows[0].id;
}

/**
 * Get or create a competency center. Competency centers are linked to practice areas.
 * If the competency center doesn't exist but the practice area does, creates it under that practice area.
 */
async function getOrCreateCompetencyCenter(
  client: PoolClient,
  competencyCenter: string | undefined,
  practiceAreaId: string | null
): Promise<string | null> {
  if (!competencyCenter || !practiceAreaId) return null;

  const ccLower = competencyCenter.toLowerCase().trim();

  // First, try to find existing competency center
  const result = await client.query(
    `SELECT id FROM competency_center 
     WHERE practice_area_id = $1 AND LOWER(name) = $2`,
    [practiceAreaId, ccLower]
  );

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Create new competency center under this practice area
  const insertResult = await client.query(
    `INSERT INTO competency_center (practice_area_id, name) VALUES ($1, $2) RETURNING id`,
    [practiceAreaId, competencyCenter.trim()]
  );

  return insertResult.rows[0].id;
}

export async function importPersons(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', count: 0, errors: ['No file uploaded'] });
    }

    // Read Excel file
    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const result: ImportResult = {
      status: 'success',
      count: 0,
      errors: []
    };

    if (workbook.SheetNames.length === 0) {
      return res.status(400).json({
        status: 'error',
        count: 0,
        errors: ['Excel file is empty or has no sheets']
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Process Persons from first sheet (any sheet name)
      const sheetName = workbook.SheetNames[0];
      const personsData = XLSX.utils.sheet_to_json(
        workbook.Sheets[sheetName]
      ) as any[];

      for (let idx = 0; idx < personsData.length; idx++) {
        const row = personsData[idx];

        // Log available columns for first row only
        if (idx === 0) {
          console.log('[DEBUG] Available columns in Excel:', Object.keys(row));
        }

        await client.query(`SAVEPOINT row_${idx}`);
        try {
          const employeeId = row['Employee ID'] || row['EmployeeID'];
          const firstName = row['First Name'] || row['FirstName'];
          const lastName = row['Last Name'] || row['LastName'];

          if (!employeeId || !firstName || !lastName) {
            result.errors.push(
              `Row ${idx + 2}: Missing required fields (Employee ID, First Name, Last Name)`
            );
            await client.query(`ROLLBACK TO SAVEPOINT row_${idx}`);
            continue;
          }

          // Auto-generate anonymized email: firstname.lastname@mail.com
          // Normalize: lowercase, trim spaces, replace with dots
          const email = `${firstName.trim().toLowerCase()}.${lastName.trim().toLowerCase()}@mail.com`.replace(/\s+/g, '.');

          // Get or create master data entries (will create if not found)
          const consultingUnitValue = row['Consulting unit'] || row['Consulting Unit'] || row['ConsultingUnit'];
          const consultingUnitId = await getOrCreateMasterData(
            client,
            'consulting_unit',
            consultingUnitValue,
            'name'
          );
          const siteId = await getOrCreateMasterData(
            client,
            'site',
            row['Site'] || row['site'] || row['Location'],
            'name'
          );
          const jobLevelId = await getOrCreateJobLevel(
            client,
            row['Job Category'] || row['JobCategory'] || row['Job category']
          );
          const practiceAreaId = await getOrCreateMasterData(
            client,
            'practice_area',
            row['Practice Area'] || row['PracticeArea'] || row['Practice area'],
            'name'
          );
          const competencyCenterId = await getOrCreateCompetencyCenter(
            client,
            row['Competency Center'] || row['CompetencyCenter'] || row['Competency center'],
            practiceAreaId
          );

          // Get status (from Excel or default to Active)
          const status = (row['Status'] || row['status'] || 'Active').trim();

          // Get lifecycle status (from Excel or default to Employed)
          const lifecycleStatus = (row['Lifecycle Status'] || row['Lifecycle status'] || row['LifecycleStatus'] || 'Employed').trim();

          await client.query(
            `INSERT INTO person (
              employee_id, first_name, last_name, email, start_date, 
              gender, status, consulting_unit_id, practice_area_id, 
              competency_center_id, lifecycle_status, site_id, employment_type, job_level_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (employee_id) DO UPDATE SET
              first_name = $2, last_name = $3, email = $4, start_date = $5,
              gender = $6, status = $7, consulting_unit_id = $8, practice_area_id = $9,
              competency_center_id = $10, lifecycle_status = $11, site_id = $12,
              employment_type = $13, job_level_id = $14,
              updated_at = NOW()`,
            [
              employeeId,
              firstName,
              lastName,
              email,
              toIsoDate(row['Start Date'] || row['Start date'] || row['StartDate']),
              row['Gender'] || row['gender'] || null,
              status,
              consultingUnitId,
              practiceAreaId,
              competencyCenterId,
              lifecycleStatus,
              siteId,
              row['Employment Type'] || row['Employment type'] || row['EmploymentType'] || null,
              jobLevelId
            ]
          );

          result.count++;
          await client.query(`RELEASE SAVEPOINT row_${idx}`);
        } catch (e) {
          await client.query(`ROLLBACK TO SAVEPOINT row_${idx}`);
          result.errors.push(
            `Row ${idx + 2}: ${(e as Error).message}`
          );
        }
      }

      await client.query('COMMIT');
      result.status = 'success';

      return res.json(result);
    } catch (error) {
      await client.query('ROLLBACK');
      result.status = 'error';
      result.errors.push((error as Error).message);
      return res.status(400).json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      count: 0,
      errors: [(error as Error).message]
    });
  }
}

export async function importProjects(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', count: 0, errors: ['No file uploaded'] });
    }

    // Read Excel file
    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const result: ImportResult = {
      status: 'success',
      count: 0,
      errors: []
    };

    if (workbook.SheetNames.length === 0) {
      return res.status(400).json({
        status: 'error',
        count: 0,
        errors: ['Excel file is empty or has no sheets']
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Process Projects from first sheet (any sheet name)
      const sheetName = workbook.SheetNames[0];
      const projectsData = XLSX.utils.sheet_to_json(
        workbook.Sheets[sheetName]
      ) as any[];

      for (let idx = 0; idx < projectsData.length; idx++) {
        const row = projectsData[idx];

        await client.query(`SAVEPOINT row_${idx}`);
        try {
          const projectCode = (row['project code'] || row['Project Code'] || row['Project code'] || '').trim();
          const projectName = (row['project name'] || row['Project Name'] || row['Project name'] || '').trim();
          const practice = (row['practice'] || row['Practice'] || '').trim();

          if (!projectCode || !projectName) {
            result.errors.push(
              `Row ${idx + 2}: Missing required fields (project code, project name)`
            );
            await client.query(`ROLLBACK TO SAVEPOINT row_${idx}`);
            continue;
          }

          // Auto-determine billability based on project code prefix (trimmed)
          // A-* = Non-billable, T-* = Billable, F-* = Billable, All else = Non-billable
          const prefix = projectCode.trim().split('-')[0].toUpperCase();
          let billableType: 'Billable' | 'Non-billable' | 'Opportunity';
          if (prefix === 'T' || prefix === 'F') {
            billableType = 'Billable';
          } else {
            // A-* and all others default to Non-billable
            billableType = 'Non-billable';
          }

          // Always set status to Active for imports (ignore any status column from Excel)
          const projectStatus = 'Active';

          // Get or create practice area (will create if not found)
          const practiceAreaId = await getOrCreateMasterData(
            client,
            'practice_area',
            practice,
            'name'
          );

          await client.query(
            `INSERT INTO project (
              project_id, reference_id, name, practice_area_id, billable_type, project_status
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (project_id) DO UPDATE SET
              reference_id = $2, name = $3, practice_area_id = $4,
              billable_type = $5, project_status = $6,
              updated_at = NOW()`,
            [
              projectCode,
              projectCode,
              projectName,
              practiceAreaId,
              billableType,
              projectStatus
            ]
          );

          result.count++;
          await client.query(`RELEASE SAVEPOINT row_${idx}`);
        } catch (e) {
          await client.query(`ROLLBACK TO SAVEPOINT row_${idx}`);
          result.errors.push(
            `Row ${idx + 2}: ${(e as Error).message}`
          );
        }
      }

      await client.query('COMMIT');
      result.status = 'success';

      return res.json(result);
    } catch (error) {
      await client.query('ROLLBACK');
      result.status = 'error';
      result.errors.push((error as Error).message);
      return res.status(400).json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      count: 0,
      errors: [(error as Error).message]
    });
  }
}

export async function importOpportunities(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', count: 0, errors: ['No file uploaded'] });
    }

    // Read Excel file
    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const result: ImportResult = {
      status: 'success',
      count: 0,
      errors: []
    };

    if (workbook.SheetNames.length === 0) {
      return res.status(400).json({
        status: 'error',
        count: 0,
        errors: ['Excel file is empty or has no sheets']
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Process Opportunities from first sheet (any sheet name)
      const sheetName = workbook.SheetNames[0];
      const opportunitiesData = XLSX.utils.sheet_to_json(
        workbook.Sheets[sheetName]
      ) as any[];

      for (let idx = 0; idx < opportunitiesData.length; idx++) {
        const row = opportunitiesData[idx];

        // Log available columns for first row only
        if (idx === 0) {
          console.log('[DEBUG] Available columns in Excel:', Object.keys(row));
        }

        await client.query(`SAVEPOINT row_${idx}`);
        try {
          const opportunityId = (row['opportunity_id'] || row['Opportunity ID'] || row['Opportunity_ID'] || '').trim();
          const opportunityName = (row['opportunity_name'] || row['Opportunity Name'] || row['Opportunity_Name'] || '').trim();

          if (!opportunityId || !opportunityName) {
            result.errors.push(
              `Row ${idx + 2}: Missing required fields (opportunity_id, opportunity_name)`
            );
            await client.query(`ROLLBACK TO SAVEPOINT row_${idx}`);
            continue;
          }

          // Get or create market unit
          const marketUnitId = await getOrCreateMasterData(
            client,
            'market_unit',
            row['market_unit'] || row['Market Unit'] || row['Market_Unit'],
            'name'
          );

          // Get or create practice area
          const practiceAreaId = await getOrCreateMasterData(
            client,
            'practice_area',
            row['practice'] || row['Practice'],
            'name'
          );

          // Parse probability (0-100)
          const probabilityStr = (row['probability'] || row['Probability'] || '').toString().trim();
          const probability = probabilityStr ? parseFloat(probabilityStr) : null;

          // Get region
          const region = (row['region'] || row['Region'] || '').toString().trim() || null;

          // Always set status to Active for imports
          const opportunityStatus = 'Active';

          await client.query(
            `INSERT INTO project (
              project_id, reference_id, name, market_unit_id, practice_area_id, 
              win_probability, billable_type, project_status, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (project_id) DO UPDATE SET
              reference_id = $2, name = $3, market_unit_id = $4, practice_area_id = $5,
              win_probability = $6, billable_type = $7, project_status = $8,
              description = $9, updated_at = NOW()`,
            [
              opportunityId,
              opportunityId,
              opportunityName,
              marketUnitId,
              practiceAreaId,
              probability,
              'Opportunity',
              opportunityStatus,
              region
            ]
          );

          result.count++;
          await client.query(`RELEASE SAVEPOINT row_${idx}`);
        } catch (e) {
          await client.query(`ROLLBACK TO SAVEPOINT row_${idx}`);
          result.errors.push(
            `Row ${idx + 2}: ${(e as Error).message}`
          );
        }
      }

      await client.query('COMMIT');
      result.status = 'success';

      return res.json(result);
    } catch (error) {
      await client.query('ROLLBACK');
      result.status = 'error';
      result.errors.push((error as Error).message);
      return res.status(400).json(result);
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      count: 0,
      errors: [(error as Error).message]
    });
  }
}
