import type { Pool } from 'pg';

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
}
