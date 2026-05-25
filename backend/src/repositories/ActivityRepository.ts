import type { Pool } from 'pg';
import type { ActivityEventType } from '../events/ActivityEventEmitter.js';

export interface ActivityEventRow {
  id: string;
  boardId: string;
  cardId: string | null;
  eventType: ActivityEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface ActivityEventInsert {
  boardId: string;
  cardId: string | null;
  eventType: ActivityEventType;
  payload: Record<string, unknown>;
}

interface RawRow {
  id: string;
  board_id: string;
  card_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string | Date; // pg returns Date for timestamptz columns
}

export class ActivityRepository {
  constructor(private readonly pool: Pool) {}

  async insert(event: ActivityEventInsert): Promise<ActivityEventRow> {
    const result = await this.pool.query<RawRow>(
      `INSERT INTO activity_events (board_id, card_id, event_type, payload)
       VALUES ($1, $2, $3, $4)
       RETURNING id, board_id, card_id, event_type, payload, created_at`,
      [event.boardId, event.cardId ?? null, event.eventType, JSON.stringify(event.payload)],
    );
    return this.toRow(result.rows[0]!);
  }

  async findByBoardId(boardId: string, limit = 50): Promise<ActivityEventRow[]> {
    const result = await this.pool.query<RawRow>(
      `SELECT id, board_id, card_id, event_type, payload, created_at
       FROM activity_events
       WHERE board_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [boardId, limit],
    );
    return result.rows.map((r) => this.toRow(r));
  }

  private toRow(r: RawRow): ActivityEventRow {
    return {
      id: r.id,
      boardId: r.board_id,
      cardId: r.card_id,
      eventType: r.event_type as ActivityEventType,
      payload: r.payload,
      createdAt: new Date(r.created_at).toISOString(),
    };
  }
}
