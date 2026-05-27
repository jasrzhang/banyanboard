// Integration tests for Labels API endpoints (board-scoped CRUD).
// Requires a running PostgreSQL instance (docker compose up -d db).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../config/db.js';

describe('Labels API', () => {
  const app = createApp();

  // Primary board for label CRUD tests
  let boardId: string;
  // Secondary board to test board-scope protection
  let otherBoardId: string;

  // Pre-existing label on the primary board (used by update/delete scope tests)
  let existingLabelId: string;
  // Pre-existing label on the secondary board (used for cross-board scope protection)
  let otherBoardLabelId: string;

  beforeAll(async () => {
    // Create primary test board
    const boardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('Test Labels Board') RETURNING id",
    );
    boardId = boardRes.rows[0]!.id;

    // Create secondary board for scope-protection tests
    const otherBoardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('Other Labels Board') RETURNING id",
    );
    otherBoardId = otherBoardRes.rows[0]!.id;

    // Seed a label on the primary board
    const labelRes = await pool.query<{ id: string }>(
      "INSERT INTO labels (board_id, name, color) VALUES ($1, 'Alpha', '#aabbcc') RETURNING id",
      [boardId],
    );
    existingLabelId = labelRes.rows[0]!.id;

    // Seed a label on the secondary board
    const otherLabelRes = await pool.query<{ id: string }>(
      "INSERT INTO labels (board_id, name, color) VALUES ($1, 'OtherLabel', '#112233') RETURNING id",
      [otherBoardId],
    );
    otherBoardLabelId = otherLabelRes.rows[0]!.id;
  });

  afterAll(async () => {
    // Deleting boards cascades to labels (and card_labels)
    await pool.query('DELETE FROM boards WHERE id = $1', [boardId]);
    await pool.query('DELETE FROM boards WHERE id = $1', [otherBoardId]);
    // Note: pool.end() is called once globally in boards.test.ts; do NOT call it here.
  });

  // ── GET /api/boards/:boardId/labels ─────────────────────────────────────────

  describe('GET /api/boards/:boardId/labels', () => {
    it('returns 200 with empty array when board has no labels', async () => {
      // Create a fresh board with no labels
      const emptyBoardRes = await pool.query<{ id: string }>(
        "INSERT INTO boards (name) VALUES ('Empty Labels Board') RETURNING id",
      );
      const emptyBoardId = emptyBoardRes.rows[0]!.id;

      try {
        const res = await request(app).get(`/api/boards/${emptyBoardId}/labels`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
      } finally {
        await pool.query('DELETE FROM boards WHERE id = $1', [emptyBoardId]);
      }
    });

    it('returns 200 with labels array (ordered by name) when labels exist', async () => {
      // Seed labels out-of-order to verify name ordering
      await pool.query(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'Zebra', '#000001'), ($1, 'Apple', '#000002')",
        [boardId],
      );

      const res = await request(app).get(`/api/boards/${boardId}/labels`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const names = res.body.map((l: { name: string }) => l.name);
      // 'Alpha' was seeded in beforeAll; 'Apple' and 'Zebra' added above
      const relevantNames = names.filter((n: string) =>
        ['Alpha', 'Apple', 'Zebra'].includes(n),
      );
      // Verify they appear in ascending alphabetical order
      expect(relevantNames).toEqual(['Alpha', 'Apple', 'Zebra']);

      // Cleanup the extra labels
      await pool.query("DELETE FROM labels WHERE board_id = $1 AND name IN ('Zebra', 'Apple')", [
        boardId,
      ]);
    });

    it('each label has: id, boardId, name, color, icon (null or string)', async () => {
      const res = await request(app).get(`/api/boards/${boardId}/labels`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      const label = res.body.find((l: { id: string }) => l.id === existingLabelId);
      expect(label).toBeDefined();
      expect(label).toMatchObject({
        id: existingLabelId,
        boardId,
        name: 'Alpha',
        color: '#aabbcc',
      });
      // icon must be present in the response (null or a string)
      expect(label).toHaveProperty('icon');
      expect(label.icon === null || typeof label.icon === 'string').toBe(true);
    });

    it('returns 400 for invalid boardId UUID format', async () => {
      const res = await request(app).get('/api/boards/not-a-valid-uuid/labels');
      expect(res.status).toBe(400);
    });

    it('returns 200 with empty array for a non-existent board UUID (no labels exist for it)', async () => {
      const res = await request(app).get(
        '/api/boards/00000000-0000-0000-0000-000000000000/labels',
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ── POST /api/boards/:boardId/labels ────────────────────────────────────────

  describe('POST /api/boards/:boardId/labels', () => {
    it('returns 201 with created label (name, color, boardId, id, icon=null) — happy path with no icon', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: 'Bug', color: '#be123c' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        boardId,
        name: 'Bug',
        color: '#be123c',
        icon: null,
      });
      // Cleanup
      await pool.query('DELETE FROM labels WHERE id = $1', [res.body.id]);
    });

    it('returns 201 with created label including icon when icon is provided', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: 'Feature', color: '#16a34a', icon: '★' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        boardId,
        name: 'Feature',
        color: '#16a34a',
        icon: '★',
      });
      // Cleanup
      await pool.query('DELETE FROM labels WHERE id = $1', [res.body.id]);
    });

    it('returns 409 when label name already exists on the same board', async () => {
      // 'Alpha' was seeded in beforeAll on boardId
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: 'Alpha', color: '#ff0000' });
      expect(res.status).toBe(409);
    });

    it('returns 400 for whitespace-only name (Zod trim + min(1) validation)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: '   ', color: '#ff0000' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for empty name', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: '', color: '#ff0000' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid hex color (plain color word)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: 'InvalidColor', color: 'red' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid hex color (malformed hex string)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: 'InvalidHex', color: '#zzzzzz' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid UUID boardId', async () => {
      const res = await request(app)
        .post('/api/boards/not-a-uuid/labels')
        .send({ name: 'Test', color: '#123456' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is missing required fields (no name)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ color: '#123456' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when body is missing required fields (no color)', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: 'NeedColor' });
      expect(res.status).toBe(400);
    });

    it('trims whitespace from name before storing (e.g., "  Bug  " → stored as "Bug")', async () => {
      const res = await request(app)
        .post(`/api/boards/${boardId}/labels`)
        .send({ name: '  TrimMe  ', color: '#123456' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('TrimMe');
      // Cleanup
      await pool.query('DELETE FROM labels WHERE id = $1', [res.body.id]);
    });
  });

  // ── PATCH /api/boards/:boardId/labels/:labelId ───────────────────────────────

  describe('PATCH /api/boards/:boardId/labels/:labelId', () => {
    // Create a dedicated label for update tests so we don't disturb the base fixture
    let updateLabelId: string;

    beforeAll(async () => {
      const res = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'UpdateTarget', '#ffffff') RETURNING id",
        [boardId],
      );
      updateLabelId = res.rows[0]!.id;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM labels WHERE id = $1', [updateLabelId]);
    });

    it('returns 200 with updated label when name is changed', async () => {
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/${updateLabelId}`)
        .send({ name: 'UpdatedName' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: updateLabelId,
        boardId,
        name: 'UpdatedName',
      });
      // Reset for subsequent tests
      await pool.query('UPDATE labels SET name = $1 WHERE id = $2', ['UpdateTarget', updateLabelId]);
    });

    it('returns 200 with updated label when color is changed', async () => {
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/${updateLabelId}`)
        .send({ color: '#abcdef' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: updateLabelId,
        boardId,
        color: '#abcdef',
      });
      // Reset
      await pool.query('UPDATE labels SET color = $1 WHERE id = $2', ['#ffffff', updateLabelId]);
    });

    it('returns 200 with updated label when icon is set to a value', async () => {
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/${updateLabelId}`)
        .send({ icon: '🔥' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: updateLabelId,
        boardId,
        icon: '🔥',
      });
    });

    it('returns 200 with updated label when icon is set to null (clear the icon)', async () => {
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/${updateLabelId}`)
        .send({ icon: null });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: updateLabelId,
        boardId,
        icon: null,
      });
    });

    it('returns 409 when updating name to match another existing label on the same board', async () => {
      // 'Alpha' already exists on boardId (seeded in outer beforeAll)
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/${updateLabelId}`)
        .send({ name: 'Alpha' });
      expect(res.status).toBe(409);
    });

    it('returns 404 when labelId does not exist', async () => {
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/00000000-0000-0000-0000-000000000000`)
        .send({ name: 'Ghost' });
      expect(res.status).toBe(404);
    });

    it('returns 404 when label exists but belongs to a different board (board-scope protection)', async () => {
      // otherBoardLabelId belongs to otherBoardId — requesting via boardId must return 404
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/${otherBoardLabelId}`)
        .send({ name: 'CrossBoardAttempt' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid body (empty object — no fields provided)', async () => {
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/${updateLabelId}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid UUID labelId', async () => {
      const res = await request(app)
        .patch(`/api/boards/${boardId}/labels/not-a-uuid`)
        .send({ name: 'Whatever' });
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /api/boards/:boardId/labels/:labelId ──────────────────────────────

  describe('DELETE /api/boards/:boardId/labels/:labelId', () => {
    it('returns 204 when label is deleted successfully', async () => {
      // Create a throwaway label to delete
      const labelRes = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'ToDelete', '#999999') RETURNING id",
        [boardId],
      );
      const toDeleteId = labelRes.rows[0]!.id;

      const res = await request(app).delete(
        `/api/boards/${boardId}/labels/${toDeleteId}`,
      );
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});

      // Verify actually deleted
      const check = await pool.query('SELECT id FROM labels WHERE id = $1', [toDeleteId]);
      expect(check.rows).toHaveLength(0);
    });

    it('returns 404 when labelId does not exist', async () => {
      const res = await request(app).delete(
        `/api/boards/${boardId}/labels/00000000-0000-0000-0000-000000000000`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when label exists but belongs to a different board (board-scope protection)', async () => {
      // otherBoardLabelId belongs to otherBoardId — requesting via boardId must return 404
      const res = await request(app).delete(
        `/api/boards/${boardId}/labels/${otherBoardLabelId}`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid UUID labelId', async () => {
      const res = await request(app).delete(`/api/boards/${boardId}/labels/not-a-uuid`);
      expect(res.status).toBe(400);
    });
  });

  // ── PUT /api/cards/:cardId/labels (card-label assignment) ───────────────────

  describe('PUT /api/cards/:cardId/labels', () => {
    let clBoardId: string;
    let clColumnId: string;
    let clCardId: string;
    let clLabel1Id: string;
    let clLabel2Id: string;
    let clOtherBoardId: string;
    let clOtherLabelId: string;

    beforeAll(async () => {
      // Create a board with a column, a card, and two labels
      const bRes = await pool.query<{ id: string }>(
        "INSERT INTO boards (name) VALUES ('CardLabel Board') RETURNING id",
      );
      clBoardId = bRes.rows[0]!.id;

      const cRes = await pool.query<{ id: string }>(
        "INSERT INTO columns (board_id, name, position) VALUES ($1, 'Backlog', 1) RETURNING id",
        [clBoardId],
      );
      clColumnId = cRes.rows[0]!.id;

      const cardRes = await pool.query<{ id: string }>(
        "INSERT INTO cards (column_id, title, position) VALUES ($1, 'Test Card', 1000) RETURNING id",
        [clColumnId],
      );
      clCardId = cardRes.rows[0]!.id;

      const l1Res = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'CL-Alpha', '#be123c') RETURNING id",
        [clBoardId],
      );
      clLabel1Id = l1Res.rows[0]!.id;

      const l2Res = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'CL-Beta', '#047857') RETURNING id",
        [clBoardId],
      );
      clLabel2Id = l2Res.rows[0]!.id;

      // A label on a different board (to test cross-board protection)
      const otherBoardRes = await pool.query<{ id: string }>(
        "INSERT INTO boards (name) VALUES ('Other CL Board') RETURNING id",
      );
      clOtherBoardId = otherBoardRes.rows[0]!.id;

      const otherLabelRes = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'OtherBoard-Label', '#6d28d9') RETURNING id",
        [clOtherBoardId],
      );
      clOtherLabelId = otherLabelRes.rows[0]!.id;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM boards WHERE id = $1', [clBoardId]);
      await pool.query('DELETE FROM boards WHERE id = $1', [clOtherBoardId]);
    });

    // Reset card_labels before each test so each test starts fresh
    beforeEach(async () => {
      await pool.query('DELETE FROM card_labels WHERE card_id = $1', [clCardId]);
    });

    it('returns 200 with labels array when assigning labels to a card (happy path)', async () => {
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clLabel1Id, clLabel2Id] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('labels');
      expect(Array.isArray(res.body.labels)).toBe(true);
      expect(res.body.labels).toHaveLength(2);

      const names = res.body.labels.map((l: { name: string }) => l.name).sort();
      expect(names).toEqual(['CL-Alpha', 'CL-Beta'].sort());

      // Each label has the expected fields
      const label = res.body.labels.find((l: { id: string }) => l.id === clLabel1Id);
      expect(label).toMatchObject({
        id: clLabel1Id,
        name: 'CL-Alpha',
        color: '#be123c',
      });
    });

    it('returns 200 with single label when assigning one label', async () => {
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clLabel1Id] });

      expect(res.status).toBe(200);
      expect(res.body.labels).toHaveLength(1);
      expect(res.body.labels[0]).toMatchObject({ id: clLabel1Id });
    });

    it('returns 200 with empty labels array when clearing all labels', async () => {
      // First assign a label
      await pool.query('INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)', [
        clCardId,
        clLabel1Id,
      ]);

      // Then clear with empty array
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('labels');
      expect(res.body.labels).toHaveLength(0);

      // Verify in DB
      const check = await pool.query('SELECT label_id FROM card_labels WHERE card_id = $1', [
        clCardId,
      ]);
      expect(check.rows).toHaveLength(0);
    });

    it('is idempotent: sending the same labelIds twice yields the same result', async () => {
      const first = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clLabel1Id] });

      const second = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clLabel1Id] });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.labels).toHaveLength(1);
      expect(second.body.labels[0]!.id).toBe(clLabel1Id);
    });

    it('replaces previous labels: assigning label2 removes label1', async () => {
      // Assign label1
      await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clLabel1Id] });

      // Replace with label2 only
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clLabel2Id] });

      expect(res.status).toBe(200);
      expect(res.body.labels).toHaveLength(1);
      expect(res.body.labels[0]!.id).toBe(clLabel2Id);

      // Verify label1 is no longer assigned
      const check = await pool.query(
        'SELECT label_id FROM card_labels WHERE card_id = $1 AND label_id = $2',
        [clCardId, clLabel1Id],
      );
      expect(check.rows).toHaveLength(0);
    });

    it('returns labels ordered by name (alphabetical)', async () => {
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clLabel2Id, clLabel1Id] }); // intentionally out of order

      expect(res.status).toBe(200);
      const names = res.body.labels.map((l: { name: string }) => l.name);
      expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    });

    it('returns 404 when the cardId does not exist', async () => {
      const res = await request(app)
        .put('/api/cards/00000000-0000-0000-0000-000000000000/labels')
        .send({ labelIds: [] });

      expect(res.status).toBe(404);
    });

    it('returns 400 when a labelId does not belong to the card\'s board (cross-board protection)', async () => {
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clOtherLabelId] });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid UUID in labelIds array', async () => {
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: ['not-a-uuid'] });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an invalid UUID cardId', async () => {
      const res = await request(app)
        .put('/api/cards/not-a-uuid/labels')
        .send({ labelIds: [] });

      expect(res.status).toBe(400);
    });

    it('returns 400 when labelIds is missing from body', async () => {
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when labelIds exceeds max (50 entries)', async () => {
      const fakeIds = Array.from(
        { length: 51 },
        (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      );
      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: fakeIds });

      expect(res.status).toBe(400);
    });

    it('returns label icon field in the response', async () => {
      // Set an icon on label1
      await pool.query('UPDATE labels SET icon = $1 WHERE id = $2', ['🔥', clLabel1Id]);

      const res = await request(app)
        .put(`/api/cards/${clCardId}/labels`)
        .send({ labelIds: [clLabel1Id] });

      expect(res.status).toBe(200);
      const label = res.body.labels.find((l: { id: string }) => l.id === clLabel1Id);
      expect(label).toHaveProperty('icon', '🔥');

      // Reset icon
      await pool.query('UPDATE labels SET icon = NULL WHERE id = $1', [clLabel1Id]);
    });
  });

  // ── GET /api/boards/:id — BoardRepository icon integration ──────────────────

  describe('GET /api/boards/:id — icon field in nested card labels', () => {
    let iconBoardId: string;
    let iconColumnId: string;
    let iconCardId: string;
    let iconLabelId: string;

    beforeAll(async () => {
      // Create a board with a column, card, and label (with icon set)
      const bRes = await pool.query<{ id: string }>(
        "INSERT INTO boards (name) VALUES ('Icon Test Board') RETURNING id",
      );
      iconBoardId = bRes.rows[0]!.id;

      const cRes = await pool.query<{ id: string }>(
        "INSERT INTO columns (board_id, name, position) VALUES ($1, 'Col', 1) RETURNING id",
        [iconBoardId],
      );
      iconColumnId = cRes.rows[0]!.id;

      const cardRes = await pool.query<{ id: string }>(
        "INSERT INTO cards (column_id, title, position) VALUES ($1, 'Card With Label', 1000) RETURNING id",
        [iconColumnId],
      );
      iconCardId = cardRes.rows[0]!.id;

      // Insert label with an icon value (if the migration has run, the column exists)
      // We attempt the insert with icon; if the column doesn't exist the test itself
      // will document the failure correctly.
      const lRes = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color, icon) VALUES ($1, 'Tagged', '#ff00ff', '⚡') RETURNING id",
        [iconBoardId],
      );
      iconLabelId = lRes.rows[0]!.id;

      await pool.query('INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)', [
        iconCardId,
        iconLabelId,
      ]);
    });

    afterAll(async () => {
      await pool.query('DELETE FROM boards WHERE id = $1', [iconBoardId]);
    });

    it('GET /api/boards/:id returns icon field in nested card labels', async () => {
      const res = await request(app).get(`/api/boards/${iconBoardId}`);
      expect(res.status).toBe(200);

      const col = res.body.columns.find((c: { id: string }) => c.id === iconColumnId);
      expect(col).toBeDefined();
      const card = col.cards.find((c: { id: string }) => c.id === iconCardId);
      expect(card).toBeDefined();
      expect(card.labels).toHaveLength(1);
      // The label should include the icon field
      expect(card.labels[0]).toHaveProperty('icon');
      expect(card.labels[0].icon).toBe('⚡');
    });

    it('GET /api/boards/:id returns icon as null for labels without an icon', async () => {
      // Create an extra label without icon on the same card
      const nullIconLabelRes = await pool.query<{ id: string }>(
        "INSERT INTO labels (board_id, name, color) VALUES ($1, 'NoIcon', '#123456') RETURNING id",
        [iconBoardId],
      );
      const nullIconLabelId = nullIconLabelRes.rows[0]!.id;

      await pool.query('INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)', [
        iconCardId,
        nullIconLabelId,
      ]);

      const res = await request(app).get(`/api/boards/${iconBoardId}`);
      expect(res.status).toBe(200);

      const col = res.body.columns.find((c: { id: string }) => c.id === iconColumnId);
      const card = col.cards.find((c: { id: string }) => c.id === iconCardId);
      const noIconLabel = card.labels.find(
        (l: { name: string }) => l.name === 'NoIcon',
      );
      expect(noIconLabel).toBeDefined();
      expect(noIconLabel).toHaveProperty('icon');
      expect(noIconLabel.icon).toBeNull();
    });
  });
});
