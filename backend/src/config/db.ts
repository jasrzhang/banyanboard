import { Pool } from 'pg';
import { config } from './env.js';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.pg.poolMax,
  idleTimeoutMillis: config.pg.poolIdleTimeoutMs,
  connectionTimeoutMillis: config.pg.connectionTimeoutMs,
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query('SELECT 1');
}

export async function closePool(): Promise<void> {
  await pool.end();
}
