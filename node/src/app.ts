import express, { Application, Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';

import healthRouter from './routes/health';
import labRouter from './routes/lab';

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

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).send(
      process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.stack
    );
  });

  return app;
}
