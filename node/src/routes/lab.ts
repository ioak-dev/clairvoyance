import { Router, Request, Response } from 'express';

import { db } from '../db/client';

const router = Router();

interface PublishBody {
  type?: unknown;
  payload?: unknown;
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
    const simulationType = body.type.trim();
    const functionName =
      simulationType.toLowerCase() === 'project' ? 'publish_lab_projects' : 'publish_lab_requests';

    const { rows } = await db.query<Record<string, Record<string, unknown>>>(
      `SELECT ${functionName}($1, $2::jsonb) AS result`,
      [simulationType, JSON.stringify(body.payload)],
    );

    res.json(rows[0]?.result ?? {});
  } catch (err) {
    console.error('Lab publish failed:', err);
    const message = err instanceof Error ? err.message : 'Lab publish failed';
    res.status(500).json({ error: message });
  }
});

export default router;
