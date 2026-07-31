import { Pool, PoolClient } from 'pg';
import XLSX from 'xlsx';
import { Request, Response } from 'express';
import { pool } from '../db/client';

interface ImportResult {
  status: 'success' | 'error';
  count: number;
  errors: string[];
}

function sendWorkbook(res: Response, sheetName: string, rows: Record<string, unknown>[], fileName: string) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(output);
}

type ExcelRow = Record<string, unknown>;

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getCellValue(row: ExcelRow, aliases: string[]): unknown {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeHeader(key))) {
      return value;
    }
  }
  return undefined;
}

function getStringValue(row: ExcelRow, aliases: string[]): string | undefined {
  const value = getCellValue(row, aliases);
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function getNumberValue(row: ExcelRow, aliases: string[]): number | undefined {
  const value = getCellValue(row, aliases);
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeBillableType(
  value: string | undefined,
): 'Billable' | 'Non-billable' | 'Opportunity' | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().replace(/[_\s-]/g, '');
  if (normalized === 'billable') return 'Billable';
  if (normalized === 'nonbillable') return 'Non-billable';
  if (normalized === 'opportunity') return 'Opportunity';
  return undefined;
}

function normalizeBookingType(value: string | undefined): 'hard' | 'soft' | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'hard' || normalized === 'soft') return normalized;
  return undefined;
}

async function resolvePersonId(client: PoolClient, row: ExcelRow): Promise<string> {
  const employeeId = getStringValue(row, ['Employee ID', 'EmployeeID', 'employee_id', 'Resource Employee ID']);
  const fullName = getStringValue(row, ['Resource Full Name', 'Resource Name', 'Full Name', 'Employee Name', 'Person Name']);

  if (!employeeId && !fullName) {
    throw new Error('Missing person identifier (Employee ID or Resource Full Name)');
  }

  if (employeeId) {
    const person = await client.query(
      `SELECT id FROM person WHERE LOWER(TRIM(employee_id)) = LOWER(TRIM($1)) LIMIT 1`,
      [employeeId],
    );
    if (person.rows.length > 0) return person.rows[0].id;
  }

  if (!fullName) {
    throw new Error(`Person not found for Employee ID: ${employeeId}`);
  }

  const byName = await client.query(
    `SELECT id
     FROM person
     WHERE LOWER(TRIM(first_name || ' ' || last_name)) = LOWER(TRIM($1))
     LIMIT 2`,
    [fullName],
  );

  if (byName.rows.length === 0) {
    throw new Error(`Person not found for name: ${fullName}`);
  }
  if (byName.rows.length > 1) {
    throw new Error(`Multiple persons found for name: ${fullName}. Use Employee ID instead.`);
  }

  return byName.rows[0].id;
}

async function resolveProject(
  client: PoolClient,
  row: ExcelRow,
): Promise<{ id: string; billableType: 'Billable' | 'Non-billable' | 'Opportunity' | null }> {
  const projectIdOrCode = getStringValue(row, ['Project ID', 'ProjectID', 'project_id', 'Project Code', 'project code']);
  const projectName = getStringValue(row, ['Project Name', 'project_name', 'project name']);

  if (!projectIdOrCode && !projectName) {
    throw new Error('Missing project identifier (Project ID/Code or Project Name)');
  }

  if (projectIdOrCode) {
    const byCode = await client.query(
      `SELECT id, billable_type FROM project WHERE LOWER(TRIM(project_id)) = LOWER(TRIM($1)) LIMIT 1`,
      [projectIdOrCode],
    );
    if (byCode.rows.length > 0) {
      return {
        id: byCode.rows[0].id,
        billableType: byCode.rows[0].billable_type,
      };
    }
  }

  if (!projectName) {
    throw new Error(`Project not found for Project ID/Code: ${projectIdOrCode}`);
  }

  const byName = await client.query(
    `SELECT id, billable_type
     FROM project
     WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
     LIMIT 2`,
    [projectName],
  );

  if (byName.rows.length === 0) {
    throw new Error(`Project not found for name: ${projectName}`);
  }
  if (byName.rows.length > 1) {
    throw new Error(`Multiple projects found for name: ${projectName}. Use Project ID/Code instead.`);
  }

  return {
    id: byName.rows[0].id,
    billableType: byName.rows[0].billable_type,
  };
}

async function resolveOptionalRequestId(client: PoolClient, row: ExcelRow): Promise<string | null> {
  const requestRef = getStringValue(row, ['Request Reference ID', 'Request ID', 'request_reference_id', 'reference_id']);
  if (!requestRef) return null;

  const request = await client.query(
    `SELECT id FROM request WHERE LOWER(TRIM(reference_id)) = LOWER(TRIM($1)) LIMIT 1`,
    [requestRef],
  );

  if (request.rows.length === 0) {
    throw new Error(`Request not found for Request Reference ID: ${requestRef}`);
  }

  return request.rows[0].id;
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

export async function importSchedules(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', count: 0, errors: ['No file uploaded'] });
    }

    const buffer = req.file.buffer;
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const result: ImportResult = {
      status: 'success',
      count: 0,
      errors: [],
    };

    if (workbook.SheetNames.length === 0) {
      return res.status(400).json({
        status: 'error',
        count: 0,
        errors: ['Excel file is empty or has no sheets'],
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as ExcelRow[];
      const scheduleHeaderCache = new Map<string, string>();

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        await client.query(`SAVEPOINT row_${idx}`);
        try {
          const isoYear = getNumberValue(row, ['Year', 'ISO Year', 'iso_year']);
          const isoWeek = getNumberValue(row, ['Week', 'ISO Week', 'iso_week']);
          const days = getNumberValue(row, ['Days', 'days', 'Days Per Week', 'days_per_week', 'days/week']);

          if (isoYear === undefined || isoWeek === undefined || days === undefined) {
            throw new Error('Missing required fields (Year, Week, Days)');
          }

          if (!Number.isInteger(isoYear) || isoYear < 2000 || isoYear > 2100) {
            throw new Error(`Invalid Year: ${isoYear}`);
          }

          if (!Number.isInteger(isoWeek) || isoWeek < 1 || isoWeek > 53) {
            throw new Error(`Invalid Week: ${isoWeek}`);
          }

          if (days < 0 || days > 10) {
            throw new Error(`Days must be between 0 and 10. Received: ${days}`);
          }

          const calendarWeek = await client.query(
            `SELECT 1 FROM calendar_week WHERE iso_year = $1 AND iso_week = $2 LIMIT 1`,
            [isoYear, isoWeek],
          );
          if (calendarWeek.rows.length === 0) {
            throw new Error(`ISO week not found in calendar: ${isoYear}-W${String(isoWeek).padStart(2, '0')}`);
          }

          const personId = await resolvePersonId(client, row);
          const project = await resolveProject(client, row);
          const requestId = await resolveOptionalRequestId(client, row);

          const rowBillableType = normalizeBillableType(
            getStringValue(row, ['Billable Type', 'billable_type', 'Billability']),
          );
          const billableType = rowBillableType || project.billableType || 'Billable';

          const rowBookingType = normalizeBookingType(
            getStringValue(row, ['Booking Type', 'booking_type', 'Commitment Type']),
          );
          const bookingType = rowBookingType || 'hard';

          const cacheKey = `${personId}|${project.id}|${requestId || 'null'}`;
          let scheduleId = scheduleHeaderCache.get(cacheKey);

          if (!scheduleId) {
            const existingSchedule = await client.query(
              `SELECT id
               FROM schedule
               WHERE person_id = $1
                 AND project_id = $2
                 AND (($3::UUID IS NULL AND request_id IS NULL) OR request_id = $3)
               ORDER BY created_at ASC
               LIMIT 1`,
              [personId, project.id, requestId],
            );

            if (existingSchedule.rows.length > 0) {
              scheduleId = existingSchedule.rows[0].id;
              await client.query(
                `UPDATE schedule
                 SET billable_type = $2,
                     booking_type = $3,
                     updated_at = NOW()
                 WHERE id = $1`,
                [scheduleId, billableType, bookingType],
              );
            } else {
              const created = await client.query(
                `INSERT INTO schedule (project_id, person_id, request_id, billable_type, booking_type)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id`,
                [project.id, personId, requestId, billableType, bookingType],
              );
              scheduleId = created.rows[0].id;
            }

            if (!scheduleId) {
              throw new Error('Failed to resolve schedule header');
            }
            scheduleHeaderCache.set(cacheKey, scheduleId);
          }

          const roundedDays = Math.round(days * 100) / 100;

          await client.query(
            `INSERT INTO schedule_week (schedule_id, person_id, project_id, iso_year, iso_week, days_per_week)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (person_id, project_id, iso_year, iso_week)
             DO UPDATE SET
               schedule_id = EXCLUDED.schedule_id,
               days_per_week = EXCLUDED.days_per_week`,
            [scheduleId, personId, project.id, isoYear, isoWeek, roundedDays],
          );

          result.count++;
          await client.query(`RELEASE SAVEPOINT row_${idx}`);
        } catch (e) {
          await client.query(`ROLLBACK TO SAVEPOINT row_${idx}`);
          result.errors.push(`Row ${idx + 2}: ${(e as Error).message}`);
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
      errors: [(error as Error).message],
    });
  }
}

export async function downloadPersons(_req: Request, res: Response) {
  try {
    const rows = await pool.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      status: string | null;
      consulting_unit_name: string | null;
      practice_area_name: string | null;
      competency_center_name: string | null;
      site_name: string | null;
      job_level_code: string | null;
      gender: string | null;
      employment_type: string | null;
      start_date: string | null;
      lifecycle_status: string | null;
    }>(
      `SELECT
         p.employee_id,
         p.first_name,
         p.last_name,
         p.status,
         cu.name AS consulting_unit_name,
         pa.name AS practice_area_name,
         cc.name AS competency_center_name,
         s.name AS site_name,
         jl.level_code AS job_level_code,
         p.gender,
         p.employment_type,
         to_char(p.start_date, 'YYYY-MM-DD') AS start_date,
         p.lifecycle_status
       FROM person p
       LEFT JOIN consulting_unit cu ON cu.id = p.consulting_unit_id
       LEFT JOIN practice_area pa ON pa.id = p.practice_area_id
       LEFT JOIN competency_center cc ON cc.id = p.competency_center_id
       LEFT JOIN site s ON s.id = p.site_id
       LEFT JOIN job_level jl ON jl.id = p.job_level_id
       ORDER BY p.last_name, p.first_name`,
    );

    const sheetRows = rows.rows.map((row) => ({
      'Employee ID': row.employee_id,
      'First Name': row.first_name,
      'Last Name': row.last_name,
      Status: row.status || 'Active',
      'Consulting Unit': row.consulting_unit_name || '',
      'Practice Area': row.practice_area_name || '',
      'Competency Center': row.competency_center_name || '',
      Site: row.site_name || '',
      'Job Category': row.job_level_code || '',
      Gender: row.gender || '',
      'Employment Type': row.employment_type || '',
      'Start Date': row.start_date || '',
      'Lifecycle Status': row.lifecycle_status || 'Employed',
    }));

    sendWorkbook(
      res,
      'Persons',
      sheetRows.length ? sheetRows : [{
        'Employee ID': '',
        'First Name': '',
        'Last Name': '',
        Status: 'Active',
        'Consulting Unit': '',
        'Practice Area': '',
        'Competency Center': '',
        Site: '',
        'Job Category': '',
        Gender: '',
        'Employment Type': '',
        'Start Date': '',
        'Lifecycle Status': 'Employed',
      }],
      'persons_import_template.xlsx',
    );
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      count: 0,
      errors: [(error as Error).message],
    });
  }
}

export async function downloadProjects(_req: Request, res: Response) {
  try {
    const rows = await pool.query<{
      project_id: string;
      name: string;
      practice_area_name: string | null;
    }>(
      `SELECT p.project_id, p.name, pa.name AS practice_area_name
       FROM project p
       LEFT JOIN practice_area pa ON pa.id = p.practice_area_id
       WHERE COALESCE(p.billable_type, '') <> 'Opportunity'
       ORDER BY p.project_id`,
    );

    const sheetRows = rows.rows.map((row) => ({
      'project code': row.project_id,
      'project name': row.name,
      practice: row.practice_area_name || '',
    }));

    sendWorkbook(
      res,
      'Projects',
      sheetRows.length ? sheetRows : [{
        'project code': '',
        'project name': '',
        practice: '',
      }],
      'projects_import_template.xlsx',
    );
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      count: 0,
      errors: [(error as Error).message],
    });
  }
}

export async function downloadOpportunities(_req: Request, res: Response) {
  try {
    const rows = await pool.query<{
      project_id: string;
      name: string;
      market_unit_name: string | null;
      practice_area_name: string | null;
      win_probability: number | null;
      region: string | null;
    }>(
      `SELECT
         p.project_id,
         p.name,
         mu.name AS market_unit_name,
         pa.name AS practice_area_name,
         p.win_probability,
         p.description AS region
       FROM project p
       LEFT JOIN market_unit mu ON mu.id = p.market_unit_id
       LEFT JOIN practice_area pa ON pa.id = p.practice_area_id
       WHERE p.billable_type = 'Opportunity'
       ORDER BY p.project_id`,
    );

    const sheetRows = rows.rows.map((row) => ({
      opportunity_id: row.project_id,
      opportunity_name: row.name,
      market_unit: row.market_unit_name || '',
      practice: row.practice_area_name || '',
      probability: row.win_probability ?? '',
      region: row.region || '',
    }));

    sendWorkbook(
      res,
      'Opportunities',
      sheetRows.length ? sheetRows : [{
        opportunity_id: '',
        opportunity_name: '',
        market_unit: '',
        practice: '',
        probability: '',
        region: '',
      }],
      'opportunities_import_template.xlsx',
    );
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      count: 0,
      errors: [(error as Error).message],
    });
  }
}

export async function downloadSchedules(_req: Request, res: Response) {
  try {
    const rows = await pool.query<{
      employee_id: string | null;
      resource_full_name: string;
      project_id: string;
      project_name: string;
      iso_year: number;
      iso_week: number;
      days_per_week: number;
      billable_type: 'Billable' | 'Non-billable' | 'Opportunity';
      booking_type: 'hard' | 'soft';
      request_reference_id: string | null;
    }>(
      `SELECT
         p.employee_id,
         (p.first_name || ' ' || p.last_name) AS resource_full_name,
         pr.project_id,
         pr.name AS project_name,
         sw.iso_year,
         sw.iso_week,
         sw.days_per_week,
         s.billable_type,
         s.booking_type,
         r.reference_id AS request_reference_id
       FROM schedule_week sw
       JOIN schedule s ON s.id = sw.schedule_id
       JOIN person p ON p.id = sw.person_id
       JOIN project pr ON pr.id = sw.project_id
       LEFT JOIN request r ON r.id = s.request_id
       ORDER BY p.employee_id NULLS LAST, pr.project_id, sw.iso_year, sw.iso_week`,
    );

    const sheetRows = rows.rows.map((row) => ({
      'Employee ID': row.employee_id || '',
      'Resource Full Name': row.resource_full_name,
      'Project ID': row.project_id,
      'Project Name': row.project_name,
      Year: row.iso_year,
      Week: row.iso_week,
      Days: row.days_per_week,
      'Billable Type': row.billable_type,
      'Booking Type': row.booking_type,
      'Request Reference ID': row.request_reference_id || '',
    }));

    sendWorkbook(
      res,
      'Schedules',
      sheetRows.length ? sheetRows : [{
        'Employee ID': '',
        'Resource Full Name': '',
        'Project ID': '',
        'Project Name': '',
        Year: '',
        Week: '',
        Days: '',
        'Billable Type': 'Billable',
        'Booking Type': 'hard',
        'Request Reference ID': '',
      }],
      'schedules_import_template.xlsx',
    );
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      count: 0,
      errors: [(error as Error).message],
    });
  }
}
