import type { Pool } from 'pg';

const DEFAULT_COLUMNS = [
  { name: 'To Do', position: 1 },
  { name: 'In Progress', position: 2 },
  { name: 'Done', position: 3 },
];

export interface BoardListItem {
  id: string;
  name: string;
  updatedAt: string;
}

export interface BoardFull {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  columns: ColumnFull[];
}

interface ColumnFull {
  id: string;
  boardId: string;
  name: string;
  position: number;
  cards: CardFull[];
}

interface CardFull {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  labels: LabelItem[];
}

interface LabelItem {
  id: string;
  name: string;
  color: string;
}

export class BoardRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<BoardListItem[]> {
    const result = await this.pool.query<BoardListItem>(
      'SELECT id, name, updated_at AS "updatedAt" FROM boards ORDER BY name',
    );
    return result.rows;
  }

  async findByIdWithColumnsAndCards(boardId: string): Promise<BoardFull | null> {
    // Single round-trip: json_agg nests columns → cards → labels in one query.
    // Subquery ordering (ORDER BY inside the derived table) is preserved by json_agg.
    const result = await this.pool.query<BoardFull>(
      `SELECT
        b.id,
        b.name,
        b.created_at  AS "createdAt",
        b.updated_at  AS "updatedAt",
        COALESCE(
          (
            SELECT json_agg(col_obj)
            FROM (
              SELECT json_build_object(
                'id',       c.id,
                'boardId',  c.board_id,
                'name',     c.name,
                'position', c.position,
                'cards', COALESCE(
                  (
                    SELECT json_agg(card_obj)
                    FROM (
                      SELECT json_build_object(
                        'id',          ca.id,
                        'columnId',    ca.column_id,
                        'title',       ca.title,
                        'description', ca.description,
                        'dueDate',     ca.due_date,
                        'position',    ca.position,
                        'createdAt',   ca.created_at,
                        'updatedAt',   ca.updated_at,
                        'labels', COALESCE(
                          (
                            SELECT json_agg(json_build_object(
                              'id',    l.id,
                              'name',  l.name,
                              'color', l.color
                            ))
                            FROM card_labels cl
                            JOIN labels l ON l.id = cl.label_id
                            WHERE cl.card_id = ca.id
                          ),
                          '[]'::json
                        )
                      ) AS card_obj
                      FROM cards ca
                      WHERE ca.column_id = c.id
                      ORDER BY ca.position
                    ) sub_cards
                  ),
                  '[]'::json
                )
              ) AS col_obj
              FROM columns c
              WHERE c.board_id = b.id
              ORDER BY c.position
            ) sub_cols
          ),
          '[]'::json
        ) AS columns
      FROM boards b
      WHERE b.id = $1`,
      [boardId],
    );
    return result.rows[0] ?? null;
  }

  async create(
    name: string,
  ): Promise<{ id: string; name: string; createdAt: string; updatedAt: string }> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      created_at: string;
      updated_at: string;
    }>('INSERT INTO boards (name) VALUES ($1) RETURNING id, name, created_at, updated_at', [name]);
    const row = result.rows[0]!;
    return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async createWithDefaultColumns(name: string): Promise<BoardFull | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const boardResult = await client.query<{ id: string }>(
        'INSERT INTO boards (name) VALUES ($1) RETURNING id',
        [name],
      );
      const boardId = boardResult.rows[0]!.id;
      for (const col of DEFAULT_COLUMNS) {
        await client.query(
          'INSERT INTO columns (board_id, name, position) VALUES ($1, $2, $3)',
          [boardId, col.name, col.position],
        );
      }
      await client.query('COMMIT');
      return this.findByIdWithColumnsAndCards(boardId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
