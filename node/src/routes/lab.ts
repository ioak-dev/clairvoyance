import { Router, Request, Response } from 'express';

import { db } from '../db/client';

const router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PublishBody {
  type?: unknown;
  payload?: unknown;
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

async function normalizeRequestJobLevelIds(
  payload: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const resolvedByName = new Map<string, string | null>();

  return Promise.all(payload.map(async (item) => {
    const next = { ...item };
    const jobLevelIdRaw = typeof next.job_level_id === 'string' ? next.job_level_id.trim() : '';
    const legacyJobCategory = typeof next.job_category === 'string' ? next.job_category.trim() : '';
    const candidate = jobLevelIdRaw || legacyJobCategory;

    if (!candidate) {
      return next;
    }

    if (isUuid(candidate)) {
      next.job_level_id = candidate;
      return next;
    }

    if (!resolvedByName.has(candidate)) {
      const { rows } = await db.query<{ id: string }>(
        'SELECT id FROM job_level WHERE level_code = $1 OR level_name = $1 LIMIT 1',
        [candidate],
      );
      resolvedByName.set(candidate, rows[0]?.id ?? null);
    }

    const resolved = resolvedByName.get(candidate);
    if (!resolved) {
      throw new Error(`Unknown job level '${candidate}'. Provide a UUID, level_code (for example L2), or level_name.`);
    }

    next.job_level_id = resolved;
    return next;
  }));
}

router.post('/publish', async (req: Request, res: Response) => {
  const body = req.body as PublishBody;

  if (typeof body.type !== 'string' || !body.type.trim()) {
    res.status(400).json({ error: 'type is required and must be a non-empty string' });
    return;
  }

  if (!Array.isArray(body.payload)) {
    res.status(400).json({ error: 'payload is required and must be an array' });
    return;
  }

  try {
    // Normalize date-range keys; reject legacy weeks payloads.
    const normalizedRangePayload = body.payload.map((item: Record<string, unknown>) => {
      if (!item || typeof item !== 'object') return item;
      if ('weeks' in item || 'days_per_week' in item || 'billable_percent' in item) {
        throw new Error('payload must use start/end/unit/roster; weeks and days_per_week are not supported');
      }

      const next = { ...item };
      if (next.start == null && next.start_date != null) next.start = next.start_date;
      if (next.end == null && next.end_date != null) next.end = next.end_date;
      if (next.start_date == null && next.start != null) next.start_date = next.start;
      if (next.end_date == null && next.end != null) next.end_date = next.end;
      if (next.unit == null) next.unit = 'utilization';
      if (next.roster == null) next.roster = [1, 1, 1, 1, 1, 0, 0];
      return next;
    });

    const simulationType = body.type.trim();
    const normalizedPayload =
      simulationType.toLowerCase() === 'request'
        ? await normalizeRequestJobLevelIds(normalizedRangePayload)
        : normalizedRangePayload;

    const functionName =
      simulationType.toLowerCase() === 'project' ? 'publish_lab_projects' : 'publish_lab_requests';

    const { rows } = await db.query<Record<string, Record<string, unknown>>>(
      `SELECT ${functionName}($1, $2::jsonb) AS result`,
      [simulationType, JSON.stringify(normalizedPayload)],
    );

    res.json(rows[0]?.result ?? {});
  } catch (err) {
    console.error('Lab publish failed:', err);
    const message = err instanceof Error ? err.message : 'Lab publish failed';
    res.status(500).json({ error: message });
  }
});

export default router;
