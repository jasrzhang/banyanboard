import type { Pool } from 'pg';
import { config } from '../config/env.js';

export interface CardRow {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  labels: Array<{ id: string; name: string; color: string }>;
}

export class CardRepository {
  constructor(private readonly pool: Pool) {}

  async create(columnId: string, title: string, description?: string | null, dueDate?: string | null): Promise<CardRow> {
    // Append position: max(position) + positionGap, or positionGap for the first card
    const posResult = await this.pool.query<{ next_pos: string }>(
      'SELECT COALESCE(MAX(position), 0) + $1 AS next_pos FROM cards WHERE column_id = $2',
      [config.cards.positionGap, columnId],
    );
    const position = parseInt(posResult.rows[0]!.next_pos, 10);

    const result = await this.pool.query<{
      id: string;
      column_id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      position: number;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO cards (column_id, title, description, due_date, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, column_id, title, description, due_date, position, created_at, updated_at`,
      [columnId, title, description ?? null, dueDate ?? null, position],
    );
    const row = result.rows[0]!;
    return {
      id: row.id,
      columnId: row.column_id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      labels: [],
    };
  }

  async move(cardId: string, columnId: string, position: number): Promise<CardRow | null> {
    const result = await this.pool.query<{
      id: string;
      column_id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      position: number;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE cards
       SET column_id = $1, position = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, column_id, title, description, due_date, position, created_at, updated_at`,
      [columnId, position, cardId],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      columnId: row.column_id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      labels: [],
    };
  }

  async update(
    cardId: string,
    fields: {
      title?: string;
      description?: string | null;
      dueDate?: string | null;
      columnId?: string;
      position?: number;
    },
  ): Promise<CardRow | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (fields.title !== undefined) { setClauses.push(`title = $${idx++}`); values.push(fields.title); }
    if (fields.description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(fields.description); }
    if (fields.dueDate !== undefined) { setClauses.push(`due_date = $${idx++}`); values.push(fields.dueDate); }
    if (fields.columnId !== undefined) { setClauses.push(`column_id = $${idx++}`); values.push(fields.columnId); }
    if (fields.position !== undefined) { setClauses.push(`position = $${idx++}`); values.push(fields.position); }

    setClauses.push(`updated_at = now()`);
    values.push(cardId);

    const sql = `UPDATE cards SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, column_id, title, description, due_date, position, created_at, updated_at`;
    const result = await this.pool.query<{
      id: string;
      column_id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      position: number;
      created_at: string;
      updated_at: string;
    }>(sql, values);

    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      columnId: row.column_id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      labels: [],
    };
  }

  async exists(cardId: string): Promise<boolean> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM cards WHERE id = $1',
      [cardId],
    );
    return parseInt(result.rows[0]!.count, 10) > 0;
  }
}
