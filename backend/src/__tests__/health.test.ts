import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Health endpoints', () => {
  const app = createApp();

  describe('GET /health/live', () => {
    it('returns 200 with status ok, numeric uptime, and string version', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        uptime: expect.any(Number),
        version: expect.any(String),
      });
    });

    it('Content-Type is application/json', async () => {
      const res = await request(app).get('/health/live');
      expect(res.headers['content-type']).toMatch(/application\/json/);
    });

    it('p95 latency across 10 requests is under 50ms', async () => {
      const times: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await request(app).get('/health/live');
        times.push(Date.now() - start);
      }
      times.sort((a, b) => a - b);
      const p95Index = Math.ceil(times.length * 0.95) - 1;
      const p95 = times[p95Index] ?? times[times.length - 1] ?? 0;
      expect(p95).toBeLessThan(50);
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 with status ok and dbStatus ok (stub repository)', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        dbStatus: 'ok',
      });
    });
  });

  describe('POST /health/live', () => {
    it('returns 404 for unsupported HTTP method', async () => {
      const res = await request(app).post('/health/live');
      expect(res.status).toBe(404);
    });
  });
});
