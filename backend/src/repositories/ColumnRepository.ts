import type { Pool, PoolClient } from 'pg';

interface ColumnRow {
  id: string;
  boardId: string;
  name: string;
  position: number;
}

const DEFAULT_COLUMNS = [
  { name: 'To Do', position: 1 },
  { name: 'In Progress', position: 2 },
  { name: 'Done', position: 3 },
];

export class ColumnRepository {
  constructor(private readonly pool: Pool) {}

  async findByBoardId(boardId: string): Promise<ColumnRow[]> {
    const result = await this.pool.query<{ id: string; board_id: string; name: string; position: number }>(
      'SELECT id, board_id, name, position FROM columns WHERE board_id = $1 ORDER BY position',
      [boardId],
    );
    return result.rows.map((r) => ({
      id: r.id,
      boardId: r.board_id,
      name: r.name,
      position: r.position,
    }));
  }

  async exists(columnId: string): Promise<boolean> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM columns WHERE id = $1',
      [columnId],
    );
    return parseInt(result.rows[0]!.count, 10) > 0;
  }

  async createDefaultsForBoard(boardId: string, client: PoolClient): Promise<void> {
    for (const col of DEFAULT_COLUMNS) {
      await client.query(
        'INSERT INTO columns (board_id, name, position) VALUES ($1, $2, $3)',
        [boardId, col.name, col.position],
      );
    }
  }
}
