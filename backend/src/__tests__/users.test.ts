// Integration tests for POST /api/users/login.
// Requires a running PostgreSQL instance (docker compose up -d db).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../config/db.js';

describe('Users API', () => {
  const app = createApp();

  beforeAll(async () => {
    // Ensure the users table is clean before the suite runs
    await pool.query('DELETE FROM users');
  });

  beforeEach(async () => {
    await pool.query('DELETE FROM users');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users');
    // pool.end() called globally elsewhere; do NOT call here
  });

  describe('POST /api/users/login', () => {
    it('returns 201 with id and firstName for a valid firstName (first call)', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ firstName: 'Alice' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
        firstName: 'Alice',
      });
    });

    it('returns 201 with the same id on a repeated login (idempotency — AC-SESSION-3)', async () => {
      const first = await request(app)
        .post('/api/users/login')
        .send({ firstName: 'Alice' });
      expect(first.status).toBe(201);
      const originalId = first.body.id as string;

      const second = await request(app)
        .post('/api/users/login')
        .send({ firstName: 'Alice' });
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(originalId);
      expect(second.body.firstName).toBe('Alice');
    });

    it('returns 400 with issues array when firstName is too short ("A")', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ firstName: 'A' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { message: 'Invalid request', issues: expect.any(Array) },
      });
      expect((res.body.error.issues as unknown[]).length).toBeGreaterThan(0);
    });

    it('returns 400 when firstName is too long (31 characters)', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ firstName: 'A'.repeat(31) });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { message: 'Invalid request', issues: expect.any(Array) },
      });
    });

    it('returns 400 when firstName contains a digit ("Al1ce")', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ firstName: 'Al1ce' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { message: 'Invalid request', issues: expect.any(Array) },
      });
    });

    it('returns 400 when firstName is an empty string', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ firstName: '' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { message: 'Invalid request', issues: expect.any(Array) },
      });
    });

    it('returns 400 when body is missing firstName field (AC-ERROR-3)', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { message: 'Invalid request', issues: expect.any(Array) },
      });
    });

    it('returns 400 when firstName is all spaces (AC-ERROR-4 server-side defence)', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({ firstName: '   ' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        error: { message: 'Invalid request', issues: expect.any(Array) },
      });
    });
  });
});
