import type { Pool, PoolClient } from 'pg';

export interface LabelRow {
  id: string;
  boardId: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface LabelCreateInput {
  boardId: string;
  name: string;
  color: string;
  icon?: string | null;
}

export interface LabelUpdateInput {
  name?: string;
  color?: string;
  icon?: string | null;
}

export class DuplicateLabelError extends Error {
  constructor(message = 'A label with this name already exists') {
    super(message);
    this.name = 'DuplicateLabelError';
  }
}

export class InvalidLabelAssignmentError extends Error {
  constructor(message = 'One or more labels do not belong to this board') {
    super(message);
    this.name = 'InvalidLabelAssignmentError';
  }
}

export class LabelRepository {
  constructor(private readonly pool: Pool) {}

  async findByBoardId(boardId: string): Promise<LabelRow[]> {
    const result = await this.pool.query<LabelRow>(
      `SELECT id, board_id AS "boardId", name, color, icon
       FROM labels
       WHERE board_id = $1
       ORDER BY LOWER(name)`,
      [boardId],
    );
    return result.rows;
  }

  async findById(labelId: string): Promise<LabelRow | null> {
    const result = await this.pool.query<LabelRow>(
      `SELECT id, board_id AS "boardId", name, color, icon
       FROM labels
       WHERE id = $1`,
      [labelId],
    );
    return result.rows[0] ?? null;
  }

  async create(input: LabelCreateInput): Promise<LabelRow> {
    try {
      const result = await this.pool.query<LabelRow>(
        `INSERT INTO labels (board_id, name, color, icon)
         VALUES ($1, $2, $3, $4)
         RETURNING id, board_id AS "boardId", name, color, icon`,
        [input.boardId, input.name, input.color, input.icon ?? null],
      );
      return result.rows[0]!;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === '23505' &&
        'constraint' in err &&
        (err as { constraint: string }).constraint === 'labels_board_id_name_unique'
      ) {
        throw new DuplicateLabelError();
      }
      throw err;
    }
  }

  async update(labelId: string, input: LabelUpdateInput): Promise<LabelRow | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(input.name);
    }
    if (input.color !== undefined) {
      setClauses.push(`color = $${idx++}`);
      values.push(input.color);
    }
    if ('icon' in input) {
      setClauses.push(`icon = $${idx++}`);
      values.push(input.icon ?? null);
    }

    if (setClauses.length === 0) return null;

    values.push(labelId);

    try {
      const result = await this.pool.query<LabelRow>(
        `UPDATE labels
         SET ${setClauses.join(', ')}
         WHERE id = $${idx}
         RETURNING id, board_id AS "boardId", name, color, icon`,
        values,
      );
      if (result.rowCount === 0) return null;
      return result.rows[0]!;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === '23505' &&
        'constraint' in err &&
        (err as { constraint: string }).constraint === 'labels_board_id_name_unique'
      ) {
        throw new DuplicateLabelError();
      }
      throw err;
    }
  }

  async delete(labelId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM labels WHERE id = $1', [labelId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getCardBoardId(cardId: string): Promise<string | null> {
    const result = await this.pool.query<{ boardId: string }>(
      `SELECT col.board_id AS "boardId"
       FROM cards c
       JOIN columns col ON col.id = c.column_id
       WHERE c.id = $1`,
      [cardId],
    );
    return result.rows[0]?.boardId ?? null;
  }

  async getAssignedLabelIds(cardId: string): Promise<string[]> {
    const result = await this.pool.query<{ label_id: string }>(
      'SELECT label_id FROM card_labels WHERE card_id = $1',
      [cardId],
    );
    return result.rows.map((r) => r.label_id);
  }

  async replaceAssignments(cardId: string, labelIds: string[]): Promise<LabelRow[]> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Validate all labelIds belong to the card's board (skip validation when empty)
      if (labelIds.length > 0) {
        const validationResult = await client.query<{ count: string }>(
          `SELECT COUNT(*) AS count
           FROM labels l
           JOIN cards c ON c.id = $1
           JOIN columns col ON col.id = c.column_id
           WHERE l.id = ANY($2::uuid[]) AND l.board_id = col.board_id`,
          [cardId, labelIds],
        );
        const validCount = parseInt(validationResult.rows[0]!.count, 10);
        if (validCount !== labelIds.length) {
          await client.query('ROLLBACK');
          throw new InvalidLabelAssignmentError();
        }
      }

      // Delete labels no longer in the set
      await client.query(
        'DELETE FROM card_labels WHERE card_id = $1 AND NOT (label_id = ANY($2::uuid[]))',
        [cardId, labelIds],
      );

      // Insert new assignments (ON CONFLICT DO NOTHING for idempotency)
      if (labelIds.length > 0) {
        await client.query(
          `INSERT INTO card_labels (card_id, label_id)
           SELECT $1, unnest($2::uuid[])
           ON CONFLICT DO NOTHING`,
          [cardId, labelIds],
        );
      }

      // Return the resulting full label set ordered by name
      const result = await client.query<LabelRow>(
        `SELECT l.id, l.board_id AS "boardId", l.name, l.color, l.icon
         FROM card_labels cl
         JOIN labels l ON l.id = cl.label_id
         WHERE cl.card_id = $1
         ORDER BY LOWER(l.name)`,
        [cardId],
      );

      await client.query('COMMIT');
      return result.rows;
    } catch (err) {
      // InvalidLabelAssignmentError already rolled back above; skip double-rollback
      if (!(err instanceof InvalidLabelAssignmentError)) {
        await client.query('ROLLBACK').catch(() => {});
      }
      throw err;
    } finally {
      client.release();
    }
  }
}
