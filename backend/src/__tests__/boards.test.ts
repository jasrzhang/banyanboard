// Integration tests for Boards API endpoints.
// Requires a running PostgreSQL instance (docker compose up -d db).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../config/db.js';

describe('Boards API', () => {
  const app = createApp();
  let boardId: string;
  let columnId: string;
  let cardId: string;

  beforeAll(async () => {
    const boardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('Test Board API') RETURNING id",
    );
    boardId = boardRes.rows[0]!.id;

    const col1Res = await pool.query<{ id: string }>(
      "INSERT INTO columns (board_id, name, position) VALUES ($1, 'To Do', 1) RETURNING id",
      [boardId],
    );
    columnId = col1Res.rows[0]!.id;

    await pool.query("INSERT INTO columns (board_id, name, position) VALUES ($1, 'Done', 2)", [
      boardId,
    ]);

    const labelRes = await pool.query<{ id: string }>(
      "INSERT INTO labels (board_id, name, color) VALUES ($1, 'bug', '#be123c') RETURNING id",
      [boardId],
    );
    const labelId = labelRes.rows[0]!.id;

    const cardRes = await pool.query<{ id: string }>(
      "INSERT INTO cards (column_id, title, description, position) VALUES ($1, 'Fix login bug', 'Description here', 1000) RETURNING id",
      [columnId],
    );
    cardId = cardRes.rows[0]!.id;

    await pool.query('INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)', [
      cardId,
      labelId,
    ]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM boards WHERE id = $1', [boardId]);
    await pool.end();
  });

  describe('GET /api/boards', () => {
    it('returns 200 with array containing the test board', async () => {
      const res = await request(app).get('/api/boards');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const testBoard = res.body.find((b: { id: string }) => b.id === boardId);
      expect(testBoard).toBeDefined();
      expect(testBoard).toMatchObject({
        id: boardId,
        name: 'Test Board API',
        updatedAt: expect.any(String),
      });
    });

    it('does not return nested columns in the board list (lightweight)', async () => {
      const res = await request(app).get('/api/boards');
      const board = res.body.find((b: { id: string }) => b.id === boardId);
      expect(board).toBeDefined();
      expect(board.columns).toBeUndefined();
    });
  });

  describe('GET /api/boards/:id', () => {
    it('returns 200 with full nested board structure', async () => {
      const res = await request(app).get(`/api/boards/${boardId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: boardId,
        name: 'Test Board API',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(Array.isArray(res.body.columns)).toBe(true);
    });

    it('columns are ordered by position ASC', async () => {
      const res = await request(app).get(`/api/boards/${boardId}`);
      const positions = res.body.columns.map((c: { position: number }) => c.position);
      expect(positions).toEqual([1, 2]);
    });

    it('cards are nested inside their column with correct fields', async () => {
      const res = await request(app).get(`/api/boards/${boardId}`);
      const todoCol = res.body.columns.find((c: { name: string }) => c.name === 'To Do');
      expect(todoCol).toBeDefined();
      expect(todoCol.cards).toHaveLength(1);
      expect(todoCol.cards[0]).toMatchObject({
        id: cardId,
        columnId,
        title: 'Fix login bug',
        description: 'Description here',
        position: 1000,
      });
    });

    it('stub-detection: card titles match fixture data exactly (not a placeholder)', async () => {
      const res = await request(app).get(`/api/boards/${boardId}`);
      const todoCol = res.body.columns.find((c: { name: string }) => c.name === 'To Do');
      expect(todoCol.cards[0].title).toBe('Fix login bug');
    });

    it('labels are nested inside cards', async () => {
      const res = await request(app).get(`/api/boards/${boardId}`);
      const todoCol = res.body.columns.find((c: { name: string }) => c.name === 'To Do');
      expect(todoCol.cards[0].labels).toHaveLength(1);
      expect(todoCol.cards[0].labels[0]).toMatchObject({
        name: 'bug',
        color: '#be123c',
      });
    });

    it('empty column returns cards: [] not null', async () => {
      const res = await request(app).get(`/api/boards/${boardId}`);
      const doneCol = res.body.columns.find((c: { name: string }) => c.name === 'Done');
      expect(doneCol).toBeDefined();
      expect(doneCol.cards).toEqual([]);
    });

    it('returns 404 for unknown board ID', async () => {
      const res = await request(app).get('/api/boards/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid UUID format', async () => {
      const res = await request(app).get('/api/boards/not-a-valid-uuid');
      expect(res.status).toBe(400);
    });
  });
});
