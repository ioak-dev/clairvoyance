import { createApp } from './app';
import { validateEnv } from './db/client';

async function bootstrap() {
  validateEnv();

  const app = createApp();
  const PORT = process.env.PORT || 4000;

  app.use((_req, res) => {
    res.status(404).send('Not found').end();
  });

  app.listen(PORT, () => {
    console.log(`Server ready at http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap server:', err);
  process.exit(1);
});
