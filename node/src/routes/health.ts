import { Router, Request, Response } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

router.get('/db', async (_req: Request, res: Response) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('Database health check failed:', err);
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

export default router;
