import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL environment variable');
  }
}

class DatabaseClient {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
      min: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '2'),
      idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '2000'),
    });

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async shutdown(): Promise<void> {
    await this.pool.end();
  }

  getPool(): Pool {
    return this.pool;
  }
}

export const db = new DatabaseClient();

export const pool = db.getPool(); // Expose pool for direct access

process.on('SIGINT', async () => {
  console.log('Shutting down database connections...');
  await db.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down database connections...');
  await db.shutdown();
  process.exit(0);
});
