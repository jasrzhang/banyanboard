// Integration tests for Automations API endpoints (board-scoped CRUD + rule evaluation).
// Requires a running PostgreSQL instance (docker compose up -d db).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../config/db.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';

describe('Automations API', () => {
  const app = createApp();

  // Primary board for all automation tests
  let boardId: string;
  // Secondary board to verify board-scope protection on DELETE
  let otherBoardId: string;
  // Columns used in trigger/action configs
  let sourceColumnId: string;
  let targetColumnId: string;
  // Labels used in trigger/action configs
  let sourceLabelId: string;
  let targetLabelId: string;
  // A card that can be moved / have labels assigned to trigger evaluations
  let cardId: string;

  beforeAll(async () => {
    // Create primary test board
    const boardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('Automations Test Board') RETURNING id",
    );
    boardId = boardRes.rows[0]!.id;

    // Create secondary board (rule-scope isolation)
    const otherBoardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('Other Automations Board') RETURNING id",
    );
    otherBoardId = otherBoardRes.rows[0]!.id;

    // Two columns on the primary board (used as trigger/action targets)
    const col1Res = await pool.query<{ id: string }>(
      "INSERT INTO columns (board_id, name, position) VALUES ($1, 'Backlog', 1) RETURNING id",
      [boardId],
    );
    sourceColumnId = col1Res.rows[0]!.id;

    const col2Res = await pool.query<{ id: string }>(
      "INSERT INTO columns (board_id, name, position) VALUES ($1, 'Done', 2) RETURNING id",
      [boardId],
    );
    targetColumnId = col2Res.rows[0]!.id;

    // Two labels on the primary board
    const lbl1Res = await pool.query<{ id: string }>(
      "INSERT INTO labels (board_id, name, color) VALUES ($1, 'Trigger Label', '#be123c') RETURNING id",
      [boardId],
    );
    sourceLabelId = lbl1Res.rows[0]!.id;

    const lbl2Res = await pool.query<{ id: string }>(
      "INSERT INTO labels (board_id, name, color) VALUES ($1, 'Action Label', '#047857') RETURNING id",
      [boardId],
    );
    targetLabelId = lbl2Res.rows[0]!.id;

    // A card on the source column used to fire automation triggers
    const cardRes = await pool.query<{ id: string }>(
      "INSERT INTO cards (column_id, title, position) VALUES ($1, 'Automation Test Card', 1000) RETURNING id",
      [sourceColumnId],
    );
    cardId = cardRes.rows[0]!.id;
  });

  afterAll(async () => {
    // Board cascade deletes all columns, labels, cards, card_labels, automation_rules, activity_events
    await pool.query('DELETE FROM boards WHERE id = $1', [boardId]);
    await pool.query('DELETE FROM boards WHERE id = $1', [otherBoardId]);
    // Note: pool.end() is called once globally in boards.test.ts; do NOT call it here.
  });

  // ── GET /api/boards/:boardId/automations ────────────────────────────────────

  describe('GET /api/boards/:boardId/automations', () => {
    it('returns 200 with empty array when board has no automation rules', async () => {
      const emptyBoardRes = await pool.query<{ id: string }>(
        "INSERT INTO boards (name) VALUES ('Empty Automations Board') RETURNING id",
      );
      const emptyBoardId = emptyBoardRes.rows[0]!.id;

      try {
        const res = await request(app).get(`/api/boards/${emptyBoardId}/automations`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      } finally {
        await pool.query('DELETE FROM boards WHERE id = $1', [emptyBoardId]);
      }
    });

    it('returns 200 with rule list in correct shape when rules exist', async () => {
      // Seed a rule directly
      const ruleRes = await pool.query<{ id: string }>(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'assign_label', $3, true)
         RETURNING id`,
        [
          boardId,
          JSON.stringify({ columnId: sourceColumnId }),
          JSON.stringify({ labelId: targetLabelId }),
        ],
      );
      const seededRuleId = ruleRes.rows[0]!.id;

      try {
        const res = await request(app).get(`/api/boards/${boardId}/automations`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        const rule = res.body.find((r: { id: string }) => r.id === seededRuleId);
        expect(rule).toBeDefined();
        expect(rule).toMatchObject({
          id: seededRuleId,
          boardId,
          triggerType: 'card_moved_to_column',
          triggerConfig: { columnId: sourceColumnId },
          actionType: 'assign_label',
          actionConfig: { labelId: targetLabelId },
          enabled: true,
          createdAt: expect.any(String),
        });
      } finally {
        await pool.query('DELETE FROM automation_rules WHERE id = $1', [seededRuleId]);
      }
    });
  });

  // ── POST /api/boards/:boardId/automations ────────────────────────────────────

  describe('POST /api/boards/:boardId/automations', () => {
    // Clean up any rules created by POST tests after each test
    let createdRuleId: string | undefined;

    afterEach(async () => {
      if (createdRuleId) {
        await pool.query('DELETE FROM automation_rules WHERE id = $1', [createdRuleId]);
        createdRuleId = undefined;
      }
    });

    it('creates a card_moved_to_column → assign_label rule and returns 201 with rule shape', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/automations`)
        .send({
          triggerType: 'card_moved_to_column',
          triggerConfig: { columnId: sourceColumnId },
          actionType: 'assign_label',
          actionConfig: { labelId: targetLabelId },
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        boardId,
        triggerType: 'card_moved_to_column',
        triggerConfig: { columnId: sourceColumnId },
        actionType: 'assign_label',
        actionConfig: { labelId: targetLabelId },
        enabled: true,
        createdAt: expect.any(String),
      });
      createdRuleId = res.body.id as string;
    });

    it('creates a card_label_assigned → move_to_column rule and returns 201', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/automations`)
        .send({
          triggerType: 'card_label_assigned',
          triggerConfig: { labelId: sourceLabelId },
          actionType: 'move_to_column',
          actionConfig: { columnId: targetColumnId },
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        boardId,
        triggerType: 'card_label_assigned',
        triggerConfig: { labelId: sourceLabelId },
        actionType: 'move_to_column',
        actionConfig: { columnId: targetColumnId },
        enabled: true,
      });
      createdRuleId = res.body.id as string;
    });

    it('returns 400 when triggerType is missing', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/automations`)
        .send({
          triggerConfig: { columnId: sourceColumnId },
          actionType: 'assign_label',
          actionConfig: { labelId: targetLabelId },
        });

      expect(res.status).toBe(400);
    });

    it('returns 400 when actionConfig is missing required field (no columnId for move_to_column)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/automations`)
        .send({
          triggerType: 'card_label_assigned',
          triggerConfig: { labelId: sourceLabelId },
          actionType: 'move_to_column',
          actionConfig: {},
        });

      expect(res.status).toBe(400);
    });

    it('returns 422 CIRCULAR_RULE_DETECTED when move_to_column pair would create a loop', async () => {
      // Rule A: card moved to targetColumn → move to sourceColumn (creates A→B, B→A loop when combined with below)
      const ruleARes = await pool.query<{ id: string }>(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'move_to_column', $3, true)
         RETURNING id`,
        [
          boardId,
          JSON.stringify({ columnId: sourceColumnId }),
          JSON.stringify({ columnId: targetColumnId }),
        ],
      );
      const ruleAId = ruleARes.rows[0]!.id;

      try {
        // Rule B: card moved to sourceColumn → move to targetColumn — creates a loop with Rule A
        const res = await request(app)
          .post(`/api/boards/${boardId}/automations`)
          .send({
            triggerType: 'card_moved_to_column',
            triggerConfig: { columnId: targetColumnId },
            actionType: 'move_to_column',
            actionConfig: { columnId: sourceColumnId },
          });

        expect(res.status).toBe(422);
        expect(res.body).toMatchObject({
          code: 'CIRCULAR_RULE_DETECTED',
          message: expect.any(String),
          details: expect.any(Array),
        });
      } finally {
        await pool.query('DELETE FROM automation_rules WHERE id = $1', [ruleAId]);
      }
    });

    it('422 response body matches { code, message, details } shape', async () => {
      // Seed both legs of the loop, then try to create the second leg via API
      const seedRes = await pool.query<{ id: string }>(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'move_to_column', $3, true)
         RETURNING id`,
        [
          boardId,
          JSON.stringify({ columnId: sourceColumnId }),
          JSON.stringify({ columnId: targetColumnId }),
        ],
      );
      const seedId = seedRes.rows[0]!.id;

      try {
        const res = await request(app)
          .post(`/api/boards/${boardId}/automations`)
          .send({
            triggerType: 'card_moved_to_column',
            triggerConfig: { columnId: targetColumnId },
            actionType: 'move_to_column',
            actionConfig: { columnId: sourceColumnId },
          });

        expect(res.status).toBe(422);
        // The body MUST have these exact keys — no extras required but these three must be present
        expect(res.body).toHaveProperty('code', 'CIRCULAR_RULE_DETECTED');
        expect(res.body).toHaveProperty('message');
        expect(typeof res.body.message).toBe('string');
        expect(res.body).toHaveProperty('details');
        expect(Array.isArray(res.body.details)).toBe(true);
      } finally {
        await pool.query('DELETE FROM automation_rules WHERE id = $1', [seedId]);
      }
    });
  });

  // ── DELETE /api/boards/:boardId/automations/:ruleId ─────────────────────────

  describe('DELETE /api/boards/:boardId/automations/:ruleId', () => {
    it('returns 204 and removes the rule when it belongs to the board', async () => {
      const ruleRes = await pool.query<{ id: string }>(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'assign_label', $3, true)
         RETURNING id`,
        [
          boardId,
          JSON.stringify({ columnId: sourceColumnId }),
          JSON.stringify({ labelId: targetLabelId }),
        ],
      );
      const ruleId = ruleRes.rows[0]!.id;

      const res = await request(app).delete(
        `/api/boards/${boardId}/automations/${ruleId}`,
      );
      expect(res.status).toBe(204);

      // Verify actually deleted from DB
      const check = await pool.query('SELECT id FROM automation_rules WHERE id = $1', [ruleId]);
      expect(check.rows).toHaveLength(0);
    });

    it('returns 404 for an unknown ruleId (nil UUID)', async () => {
      const res = await request(app).delete(
        `/api/boards/${boardId}/automations/00000000-0000-0000-0000-000000000000`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when ruleId exists but belongs to a different board', async () => {
      // Seed a rule on the OTHER board
      const otherRuleRes = await pool.query<{ id: string }>(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'assign_label', $3, true)
         RETURNING id`,
        [
          otherBoardId,
          JSON.stringify({ columnId: '00000000-0000-0000-0000-000000000001' }),
          JSON.stringify({ labelId: '00000000-0000-0000-0000-000000000002' }),
        ],
      );
      const otherRuleId = otherRuleRes.rows[0]!.id;

      try {
        // Attempt DELETE scoped to the primary board — must be 404
        const res = await request(app).delete(
          `/api/boards/${boardId}/automations/${otherRuleId}`,
        );
        expect(res.status).toBe(404);
      } finally {
        await pool.query('DELETE FROM automation_rules WHERE id = $1', [otherRuleId]);
      }
    });
  });

  // ── Trigger evaluation ───────────────────────────────────────────────────────

  describe('Trigger evaluation (fire-and-forget)', () => {
    // Clean up all automation_rules on the primary board between tests
    beforeEach(async () => {
      await pool.query('DELETE FROM automation_rules WHERE board_id = $1', [boardId]);
      // Reset the card back to sourceColumn so each test starts with a known state
      await pool.query('UPDATE cards SET column_id = $1 WHERE id = $2', [sourceColumnId, cardId]);
      // Clear all labels from the card
      await pool.query('DELETE FROM card_labels WHERE card_id = $1', [cardId]);
    });

    it('PATCH /api/cards/:id with new columnId fires matching card_moved_to_column rule and assigns label', async () => {
      // Create a rule: moved to targetColumn → assign targetLabel
      await pool.query(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'assign_label', $3, true)`,
        [
          boardId,
          JSON.stringify({ columnId: targetColumnId }),
          JSON.stringify({ labelId: targetLabelId }),
        ],
      );

      // Move the card to the target column
      const res = await request(app)
        .patch(`/api/cards/${cardId}`)
        .send({ columnId: targetColumnId, position: 1000 });

      expect(res.status).toBe(200);

      // Give fire-and-forget evaluation time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the label was assigned to the card
      const labelCheck = await pool.query(
        'SELECT label_id FROM card_labels WHERE card_id = $1 AND label_id = $2',
        [cardId, targetLabelId],
      );
      expect(labelCheck.rows).toHaveLength(1);
    });

    it('PUT /api/cards/:id/labels fires matching card_label_assigned rule and moves card to column', async () => {
      // Create a rule: sourceLabelId assigned → move to targetColumn
      await pool.query(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_label_assigned', $2, 'move_to_column', $3, true)`,
        [
          boardId,
          JSON.stringify({ labelId: sourceLabelId }),
          JSON.stringify({ columnId: targetColumnId }),
        ],
      );

      // Assign the trigger label to the card (card starts in sourceColumn per beforeEach)
      const res = await request(app)
        .put(`/api/cards/${cardId}/labels`)
        .send({ labelIds: [sourceLabelId] });

      expect(res.status).toBe(200);

      // Give fire-and-forget evaluation time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the card was moved to the target column
      const cardCheck = await pool.query<{ column_id: string }>(
        'SELECT column_id FROM cards WHERE id = $1',
        [cardId],
      );
      expect(cardCheck.rows[0]!.column_id).toBe(targetColumnId);
    });

    it('primary PATCH op returns 200 even when target label was deleted (stale rule — eval fails gracefully)', async () => {
      // Create a rule pointing at a label we will immediately delete (simulating a stale rule)
      const staleLabel = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'Stale Label', '#cccccc') RETURNING id",
        [boardId],
      );
      const staleLabelId = staleLabel.rows[0]!.id;

      await pool.query(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'assign_label', $3, true)`,
        [
          boardId,
          JSON.stringify({ columnId: targetColumnId }),
          JSON.stringify({ labelId: staleLabelId }),
        ],
      );

      // Delete the label — the rule is now stale
      await pool.query('DELETE FROM labels WHERE id = $1', [staleLabelId]);

      // Import and spy on the rootLogger.warn BEFORE the request
      const loggerModule = await import('../config/logger.js');
      const warnSpy = vi.spyOn(loggerModule.rootLogger, 'warn');

      try {
        // Primary operation must still succeed
        const res = await request(app)
          .patch(`/api/cards/${cardId}`)
          .send({ columnId: targetColumnId, position: 2000 });

        expect(res.status).toBe(200);

        // Give fire-and-forget evaluation time to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify RULE_EXECUTION_FAILED was logged at warn level
        const failCall = warnSpy.mock.calls.find((args) => {
          const msg = args[0] as string;
          return msg.includes('RULE_EXECUTION_FAILED') || msg === 'RULE_EXECUTION_FAILED';
        });
        expect(failCall).toBeDefined();
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('automation_triggered activity event is recorded in activity_events when a rule fires', async () => {
      const activityRepo = new ActivityRepository(pool);

      // Rule: card moved to targetColumn → assign targetLabel
      await pool.query(
        `INSERT INTO automation_rules
           (board_id, trigger_type, trigger_config, action_type, action_config, enabled)
         VALUES ($1, 'card_moved_to_column', $2, 'assign_label', $3, true)`,
        [
          boardId,
          JSON.stringify({ columnId: targetColumnId }),
          JSON.stringify({ labelId: targetLabelId }),
        ],
      );

      // Trigger the rule
      const res = await request(app)
        .patch(`/api/cards/${cardId}`)
        .send({ columnId: targetColumnId, position: 3000 });

      expect(res.status).toBe(200);

      // Give fire-and-forget evaluation time to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify an automation_triggered activity event was recorded
      const events = await activityRepo.findByBoardId(boardId);
      const triggerEvent = events.find(
        (e) => e.eventType === 'automation_triggered' && e.cardId === cardId,
      );
      expect(triggerEvent).toBeDefined();
      expect(triggerEvent?.boardId).toBe(boardId);
    });
  });
});
