// Integration tests for the Activity Feed — Phase 1: Backend Core.
// Covers: ActivityRepository, ActivityService, GET /api/boards/:boardId/activity endpoint.
// Requires a running PostgreSQL instance (docker compose up -d db).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../config/db.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { ActivityService } from '../services/ActivityService.js';
import { ActivityEventEmitter } from '../events/ActivityEventEmitter.js';

describe('Activity Feed — Backend Core', () => {
  const app = createApp();
  let boardId: string;
  let columnId: string;
  let cardId: string;

  beforeAll(async () => {
    const boardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('Activity Test Board') RETURNING id",
    );
    boardId = boardRes.rows[0]!.id;

    const colRes = await pool.query<{ id: string }>(
      "INSERT INTO columns (board_id, name, position) VALUES ($1, 'Backlog', 1) RETURNING id",
      [boardId],
    );
    columnId = colRes.rows[0]!.id;

    const cardRes = await pool.query<{ id: string }>(
      "INSERT INTO cards (column_id, title, position) VALUES ($1, 'Activity Seed Card', 1000) RETURNING id",
      [columnId],
    );
    cardId = cardRes.rows[0]!.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM boards WHERE id = $1', [boardId]);
  });

  // ── ActivityRepository ─────────────────────────────────────────────────────

  describe('ActivityRepository', () => {
    it('insert stores an activity_events row readable by findByBoardId', async () => {
      const repo = new ActivityRepository(pool);

      await repo.insert({
        boardId,
        cardId,
        eventType: 'card_created',
        payload: { cardTitle: 'Activity Seed Card' },
      });

      const events = await repo.findByBoardId(boardId);
      expect(events.length).toBeGreaterThanOrEqual(1);

      const created = events.find((e) => e.eventType === 'card_created' && e.cardId === cardId);
      expect(created).toMatchObject({
        id: expect.any(String),
        boardId,
        cardId,
        eventType: 'card_created',
        payload: { cardTitle: 'Activity Seed Card' },
        createdAt: expect.any(String),
      });
    });

    it('findByBoardId returns events in newest-first order', async () => {
      const repo = new ActivityRepository(pool);

      // Insert two events with a brief gap so created_at differs
      await repo.insert({ boardId, cardId, eventType: 'card_updated', payload: { cardTitle: 'First' } });
      await repo.insert({ boardId, cardId, eventType: 'card_moved', payload: { cardTitle: 'Second' } });

      const events = await repo.findByBoardId(boardId);
      // The most recently inserted 'card_moved' event must come before the 'card_updated' one
      const movedIdx = events.findIndex((e) => e.eventType === 'card_moved' && (e.payload as Record<string, unknown>)['cardTitle'] === 'Second');
      const updatedIdx = events.findIndex((e) => e.eventType === 'card_updated' && (e.payload as Record<string, unknown>)['cardTitle'] === 'First');
      expect(movedIdx).toBeLessThan(updatedIdx);
    });

    it('findByBoardId returns at most 50 events regardless of total count', async () => {
      // Insert a fresh board so we can control the exact row count
      const b2Res = await pool.query<{ id: string }>(
        "INSERT INTO boards (name) VALUES ('Cap Test Board') RETURNING id",
      );
      const b2Id = b2Res.rows[0]!.id;
      const c2Res = await pool.query<{ id: string }>(
        "INSERT INTO columns (board_id, name, position) VALUES ($1, 'Col', 1) RETURNING id",
        [b2Id],
      );
      const c2Id = c2Res.rows[0]!.id;
      const card2Res = await pool.query<{ id: string }>(
        "INSERT INTO cards (column_id, title, position) VALUES ($1, 'Cap Card', 1000) RETURNING id",
        [c2Id],
      );
      const card2Id = card2Res.rows[0]!.id;

      const repo = new ActivityRepository(pool);
      // Insert 55 events
      for (let i = 0; i < 55; i++) {
        await repo.insert({ boardId: b2Id, cardId: card2Id, eventType: 'card_updated', payload: { cardTitle: `Card ${i}` } });
      }

      const events = await repo.findByBoardId(b2Id);
      expect(events).toHaveLength(50);

      // Cleanup
      await pool.query('DELETE FROM boards WHERE id = $1', [b2Id]);
    });
  });

  // ── ActivityService ────────────────────────────────────────────────────────

  describe('ActivityService', () => {
    it('recordEvent writes a DB row and emits an "activity" event on the emitter', async () => {
      const repo = new ActivityRepository(pool);
      const emitter = new ActivityEventEmitter();
      const service = new ActivityService(repo, emitter);

      let emittedPayload: unknown = null;
      emitter.on((evt) => { emittedPayload = evt; });

      await service.recordEvent({
        boardId,
        cardId,
        eventType: 'card_created',
        payload: { cardTitle: 'Service Test Card' },
      });

      // DB row must exist
      const events = await repo.findByBoardId(boardId);
      const row = events.find(
        (e) => e.eventType === 'card_created' && (e.payload as Record<string, unknown>)['cardTitle'] === 'Service Test Card',
      );
      expect(row).toBeDefined();
      expect(row?.boardId).toBe(boardId);

      // Emitter must have fired
      expect(emittedPayload).toMatchObject({
        boardId,
        cardId,
        eventType: 'card_created',
        payload: { cardTitle: 'Service Test Card' },
      });
    });
  });

  // ── GET /api/boards/:boardId/activity ─────────────────────────────────────

  describe('GET /api/boards/:boardId/activity', () => {
    it('returns 200 with a JSON array of activity events for the board', async () => {
      // Seed at least one event directly via SQL so we have something to read
      await pool.query(
        `INSERT INTO activity_events (board_id, card_id, event_type, payload)
         VALUES ($1, $2, 'card_created', $3)`,
        [boardId, cardId, JSON.stringify({ cardTitle: 'Endpoint Test Card' })],
      );

      const res = await request(app).get(`/api/boards/${boardId}/activity`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const entry = res.body.find(
        (e: { eventType: string; cardId: string }) =>
          e.eventType === 'card_created' && e.cardId === cardId,
      );
      expect(entry).toMatchObject({
        id: expect.any(String),
        boardId,
        cardId,
        eventType: 'card_created',
        payload: expect.objectContaining({ cardTitle: 'Endpoint Test Card' }),
        createdAt: expect.any(String),
      });
    });

    it('returns 200 with an empty array when the board has no activity', async () => {
      const emptyBoardRes = await pool.query<{ id: string }>(
        "INSERT INTO boards (name) VALUES ('Empty Activity Board') RETURNING id",
      );
      const emptyBoardId = emptyBoardRes.rows[0]!.id;

      const res = await request(app).get(`/api/boards/${emptyBoardId}/activity`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);

      await pool.query('DELETE FROM boards WHERE id = $1', [emptyBoardId]);
    });

    it('returns 400 when boardId is not a valid UUID', async () => {
      const res = await request(app).get('/api/boards/not-a-uuid/activity');
      expect(res.status).toBe(400);
    });
  });
});
