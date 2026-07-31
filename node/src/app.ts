import express, { Application, Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
// Multer types are not installed in this repo; use require to keep strict build clean.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multer: any = require('multer');

import healthRouter from './routes/health';
import labRouter from './routes/lab';
import {
  importPersons,
  importProjects,
  importOpportunities,
  importSchedules,
  downloadPersons,
  downloadProjects,
  downloadOpportunities,
  downloadSchedules,
} from './routes/import';

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function resolveCorsOrigin(): CorsOptions['origin'] {
  const configured = process.env.CORS_ORIGIN?.trim();

  if (!configured || configured === '*') {
    return '*';
  }

  const allowed = configured.split(',').map((origin) => origin.trim()).filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    return (origin, callback) => {
      if (!origin || allowed.includes(origin) || LOCALHOST_ORIGIN.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    };
  }

  return allowed.length === 1 ? allowed[0] : allowed;
}

export function createApp(): Application {
  const app = express();

  // Setup multer for file uploads
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (_req: any, file: any, cb: any) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
      }
    }
  });

  app.use(express.json({ limit: '5mb' }));
  app.use(
    cors({
      origin: resolveCorsOrigin(),
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
    })
  );

  app.use('/health', healthRouter);
  app.use('/api/lab', labRouter);
  app.post('/api/import/persons', upload.single('file'), importPersons);
  app.post('/api/import/projects', upload.single('file'), importProjects);
  app.post('/api/import/opportunities', upload.single('file'), importOpportunities);
  app.post('/api/import/schedules', upload.single('file'), importSchedules);

  app.get('/api/import/persons/download', downloadPersons);
  app.get('/api/import/projects/download', downloadProjects);
  app.get('/api/import/opportunities/download', downloadOpportunities);
  app.get('/api/import/schedules/download', downloadSchedules);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).send(
      process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.stack
    );
  });

  return app;
}
