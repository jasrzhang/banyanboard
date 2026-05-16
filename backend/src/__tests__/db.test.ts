import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { checkDatabaseConnection, closePool, pool } from '../config/db.js';

// Integration tests — require the PostgreSQL service from docker-compose.
// Before running: docker compose up -d db
// Default credentials match docker-compose.yml defaults (banyan/changeme).
// Override with TEST_DATABASE_URL env var if using different credentials.

describe('Database connectivity', () => {
  afterAll(async () => {
    await closePool();
  });

  it('SELECT 1 AS value returns 1 via the pool', async () => {
    const result = await pool.query<{ value: number }>('SELECT 1 AS value');
    expect(result.rows[0]?.value).toBe(1);
  });

  it('checkDatabaseConnection() resolves against real DB', async () => {
    await expect(checkDatabaseConnection()).resolves.toBeUndefined();
  });

  it('rejects with an error for wrong credentials', async () => {
    const badPool = new Pool({
      connectionString: 'postgres://wrong:wrong@localhost:5432/nonexistent',
      connectionTimeoutMillis: 3000,
    });
    await expect(badPool.query('SELECT 1')).rejects.toThrow();
    await badPool.end();
  });

  it('pool is usable before closePool() ends the suite cleanly', async () => {
    // Verifies pool remains functional throughout the test suite.
    // afterAll closes the pool — if closePool() hangs, vitest times out (that IS the failure signal).
    const result = await pool.query<{ value: number }>('SELECT 1 AS value');
    expect(result.rows[0]?.value).toBe(1);
  });
});
