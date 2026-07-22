import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';

import healthRouter from './routes/health';
import labRouter from './routes/lab';

export function createApp(): Application {
  const app = express();

  app.use(express.json({ limit: '5mb' }));
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
    })
  );

  app.use('/health', healthRouter);
  app.use('/lab', labRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).send(
      process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.stack
    );
  });

  return app;
}
