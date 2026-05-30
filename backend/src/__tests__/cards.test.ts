// Integration tests for Cards API endpoints (POST card, PATCH card move, activity hooks, automation triggers).
// Requires a running PostgreSQL instance (docker compose up -d db).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../config/db.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';

describe('Cards API', () => {
  const app = createApp();
  let boardId: string;
  let columnId: string;
  let column2Id: string;
  let existingCardId: string;

  beforeAll(async () => {
    const boardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('Test Cards Board') RETURNING id",
    );
    boardId = boardRes.rows[0]!.id;

    const col1Res = await pool.query<{ id: string }>(
      "INSERT INTO columns (board_id, name, position) VALUES ($1, 'To Do', 1) RETURNING id",
      [boardId],
    );
    columnId = col1Res.rows[0]!.id;

    const col2Res = await pool.query<{ id: string }>(
      "INSERT INTO columns (board_id, name, position) VALUES ($1, 'Done', 2) RETURNING id",
      [boardId],
    );
    column2Id = col2Res.rows[0]!.id;

    const cardRes = await pool.query<{ id: string }>(
      "INSERT INTO cards (column_id, title, position) VALUES ($1, 'Existing Card', 1000) RETURNING id",
      [columnId],
    );
    existingCardId = cardRes.rows[0]!.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM boards WHERE id = $1', [boardId]);
  });

  describe('POST /api/columns/:columnId/cards', () => {
    it('returns 201 with full card object on valid input', async () => {
      const res = await request(app)
        .post(`/api/columns/${columnId}/cards`)
        .send({ title: 'Write API docs' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        columnId,
        title: 'Write API docs',
        position: expect.any(Number),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('stub-detection: new card title matches typed input exactly', async () => {
      const res = await request(app)
        .post(`/api/columns/${columnId}/cards`)
        .send({ title: 'Unique Title XYZ123' });
      expect(res.body.title).toBe('Unique Title XYZ123');
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app).post(`/api/columns/${columnId}/cards`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when title is empty string', async () => {
      const res = await request(app)
        .post(`/api/columns/${columnId}/cards`)
        .send({ title: '' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when columnId does not exist', async () => {
      const res = await request(app)
        .post('/api/columns/00000000-0000-0000-0000-000000000000/cards')
        .send({ title: 'Orphan card' });
      expect(res.status).toBe(404);
    });

    it('new card receives auto-assigned position >= 1000', async () => {
      const newColRes = await pool.query<{ id: string }>(
        "INSERT INTO columns (board_id, name, position) VALUES ($1, 'Fresh', 99) RETURNING id",
        [boardId],
      );
      const freshColId = newColRes.rows[0]!.id;

      const res = await request(app)
        .post(`/api/columns/${freshColId}/cards`)
        .send({ title: 'First card' });
      expect(res.status).toBe(201);
      expect(res.body.position).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('PATCH /api/cards/:cardId', () => {
    it('returns 200 with updated card after cross-column move', async () => {
      const res = await request(app)
        .patch(`/api/cards/${existingCardId}`)
        .send({ columnId: column2Id, position: 1000 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: existingCardId,
        columnId: column2Id,
        position: 1000,
      });
    });

    it('stub-detection: DB column_id is updated after move (SELECT confirms DB state)', async () => {
      await request(app)
        .patch(`/api/cards/${existingCardId}`)
        .send({ columnId: columnId, position: 2000 });

      const dbRes = await pool.query<{ column_id: string; position: number }>(
        'SELECT column_id, position FROM cards WHERE id = $1',
        [existingCardId],
      );
      expect(dbRes.rows[0]!.column_id).toBe(columnId);
      expect(dbRes.rows[0]!.position).toBe(2000);
    });

    it('returns 404 when cardId does not exist', async () => {
      const res = await request(app)
        .patch('/api/cards/00000000-0000-0000-0000-000000000000')
        .send({ columnId: column2Id, position: 1000 });
      expect(res.status).toBe(404);
    });

    it('returns 400 when body is empty', async () => {
      const res = await request(app).patch(`/api/cards/${existingCardId}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 when columnId is not a valid UUID', async () => {
      const res = await request(app)
        .patch(`/api/cards/${existingCardId}`)
        .send({ columnId: 'not-a-uuid', position: 1000 });
      expect(res.status).toBe(400);
    });
  });

  // ── Activity event hooks ───────────────────────────────────────────────────

  describe('Activity event hooks', () => {
    it('card create (POST /api/columns/:id/cards) writes a card_created activity row', async () => {
      const activityRepo = new ActivityRepository(pool);

      const res = await request(app)
        .post(`/api/columns/${columnId}/cards`)
        .send({ title: 'Activity Hook Card' });
      expect(res.status).toBe(201);

      const createdCardId: string = res.body.id;

      // Allow the fire-and-forget recordEvent to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const events = await activityRepo.findByBoardId(boardId);
      const hook = events.find(
        (e) => e.eventType === 'card_created' && e.cardId === createdCardId,
      );
      expect(hook).toBeDefined();
      expect(hook?.boardId).toBe(boardId);
      expect((hook?.payload as Record<string, unknown>)['cardTitle']).toBe('Activity Hook Card');
    });

    it('card move (PATCH /api/cards/:id with new columnId) writes a card_moved activity row', async () => {
      const activityRepo = new ActivityRepository(pool);

      // Reset existingCard to columnId first so we know the before-state
      await request(app)
        .patch(`/api/cards/${existingCardId}`)
        .send({ columnId, position: 3000 });

      const res = await request(app)
        .patch(`/api/cards/${existingCardId}`)
        .send({ columnId: column2Id, position: 1000 });
      expect(res.status).toBe(200);

      // Allow the fire-and-forget recordEvent to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const events = await activityRepo.findByBoardId(boardId);
      const hook = events.find(
        (e) => e.eventType === 'card_moved' && e.cardId === existingCardId,
      );
      expect(hook).toBeDefined();
      expect(hook?.boardId).toBe(boardId);
    });
  });

  // ── Automation trigger hooks ──────────────────────────────────────────────────
  // These tests verify that card operations fire the automation evaluation engine
  // (fire-and-forget) without breaking the primary HTTP response.

  describe('Automation trigger hooks', () => {
    // Automation-specific fixtures: a dedicated card and a label for action targets
    let autoLabelId: string;
    let autoCardId: string;

    beforeAll(async () => {
      const labelRes = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'Auto Action Label', '#6d28d9') RETURNING id",
        [boardId],
      );
      autoLabelId = labelRes.rows[0]!.id;

      const cardRes = await pool.query<{ id: string }>(
        "INSERT INTO cards (column_id, title, position) VALUES ($1, 'Auto Trigger Card', 5000) RETURNING id",
        [columnId],
      );
      autoCardId = cardRes.rows[0]!.id;
    });

    // Reset card position and labels between tests; remove automation rules
    beforeEach(async () => {
      await pool.query('DELETE FROM automation_rules WHERE board_id = $1', [boardId]);
      await pool.query('UPDATE cards SET column_id = $1 WHERE id = $2', [columnId, autoCardId]);
      await pool.query('DELETE FROM card_labels WHERE card_id = $1', [autoCardId]);
    });

    it('PATCH /api/cards/:id with new columnId fires card_moved_to_column rule — primary op returns 200 and action executes', async () => {
      // Rule: card moved to column2 → assign autoLabel
      await pool.query(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'assign_label', $3, true)`,
        [
          boardId,
          JSON.stringify({ columnId: column2Id }),
          JSON.stringify({ labelId: autoLabelId }),
        ],
      );

      const res = await request(app)
        .patch(`/api/cards/${autoCardId}`)
        .send({ columnId: column2Id, position: 1000 });

      // Primary operation must succeed regardless of rule evaluation
      expect(res.status).toBe(200);

      // Allow fire-and-forget evaluation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The action (assign label) should have been applied
      const labelCheck = await pool.query(
        'SELECT label_id FROM card_labels WHERE card_id = $1 AND label_id = $2',
        [autoCardId, autoLabelId],
      );
      expect(labelCheck.rows).toHaveLength(1);
    });

    it('PUT /api/cards/:id/labels fires card_label_assigned rule — primary op returns 200 and action executes', async () => {
      // Rule: autoLabel assigned → move card to column2
      await pool.query(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_label_assigned', $2, 'move_to_column', $3, true)`,
        [
          boardId,
          JSON.stringify({ labelId: autoLabelId }),
          JSON.stringify({ columnId: column2Id }),
        ],
      );

      const res = await request(app)
        .put(`/api/cards/${autoCardId}/labels`)
        .send({ labelIds: [autoLabelId] });

      // Primary operation must succeed regardless of rule evaluation
      expect(res.status).toBe(200);

      // Allow fire-and-forget evaluation to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // The action (move to column) should have been applied
      const cardCheck = await pool.query<{ column_id: string }>(
        'SELECT column_id FROM cards WHERE id = $1',
        [autoCardId],
      );
      expect(cardCheck.rows[0]!.column_id).toBe(column2Id);
    });

    it('PATCH /api/cards/:id returns 200 even when rule evaluation fails (fire-and-forget tolerance)', async () => {
      // Rule pointing at a non-existent label — evaluation will fail silently
      await pool.query(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'assign_label', $3, true)`,
        [
          boardId,
          JSON.stringify({ columnId: column2Id }),
          JSON.stringify({ labelId: '00000000-0000-0000-0000-000000000000' }),
        ],
      );

      const res = await request(app)
        .patch(`/api/cards/${autoCardId}`)
        .send({ columnId: column2Id, position: 2000 });

      // The primary PATCH must still return 200 even when rule eval throws
      expect(res.status).toBe(200);
    });
  });
});
