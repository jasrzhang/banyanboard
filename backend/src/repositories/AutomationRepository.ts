import type { Pool } from 'pg';

export interface AutomationRule {
  id: string;
  boardId: string;
  triggerType: 'card_moved_to_column' | 'card_label_assigned' | 'card_due_date_set';
  triggerConfig: Record<string, string>;
  actionType: 'assign_label' | 'move_to_column' | 'notify';
  actionConfig: Record<string, string>;
  enabled: boolean;
  createdAt: string;
}

export interface CreateAutomationRuleData {
  triggerType: AutomationRule['triggerType'];
  triggerConfig: Record<string, string>;
  actionType: AutomationRule['actionType'];
  actionConfig: Record<string, string>;
}

interface RawRow {
  id: string;
  board_id: string;
  trigger_type: string;
  trigger_config: Record<string, string>;
  action_type: string;
  action_config: Record<string, string>;
  enabled: boolean;
  created_at: string | Date;
}

function toRule(r: RawRow): AutomationRule {
  return {
    id: r.id,
    boardId: r.board_id,
    triggerType: r.trigger_type as AutomationRule['triggerType'],
    triggerConfig: r.trigger_config,
    actionType: r.action_type as AutomationRule['actionType'],
    actionConfig: r.action_config,
    enabled: r.enabled,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export class AutomationRepository {
  constructor(private readonly pool: Pool) {}

  async findByBoardId(boardId: string): Promise<AutomationRule[]> {
    const result = await this.pool.query<RawRow>(
      `SELECT id, board_id, trigger_type, trigger_config, action_type, action_config, enabled, created_at
       FROM automation_rules
       WHERE board_id = $1
       ORDER BY created_at ASC`,
      [boardId],
    );
    return result.rows.map(toRule);
  }

  async findByBoardAndId(boardId: string, id: string): Promise<AutomationRule | null> {
    const result = await this.pool.query<RawRow>(
      `SELECT id, board_id, trigger_type, trigger_config, action_type, action_config, enabled, created_at
       FROM automation_rules
       WHERE board_id = $1 AND id = $2`,
      [boardId, id],
    );
    return result.rows[0] ? toRule(result.rows[0]) : null;
  }

  async create(boardId: string, data: CreateAutomationRuleData): Promise<AutomationRule> {
    const result = await this.pool.query<RawRow>(
      `INSERT INTO automation_rules (board_id, trigger_type, trigger_config, action_type, action_config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, board_id, trigger_type, trigger_config, action_type, action_config, enabled, created_at`,
      [
        boardId,
        data.triggerType,
        JSON.stringify(data.triggerConfig),
        data.actionType,
        JSON.stringify(data.actionConfig),
      ],
    );
    return toRule(result.rows[0]!);
  }

  async delete(boardId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM automation_rules WHERE board_id = $1 AND id = $2',
      [boardId, id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findMoveRulesByBoard(boardId: string): Promise<AutomationRule[]> {
    const result = await this.pool.query<RawRow>(
      `SELECT id, board_id, trigger_type, trigger_config, action_type, action_config, enabled, created_at
       FROM automation_rules
       WHERE board_id = $1
         AND trigger_type = 'card_moved_to_column'
         AND action_type = 'move_to_column'`,
      [boardId],
    );
    return result.rows.map(toRule);
  }

  async findEnabledByTrigger(
    boardId: string,
    triggerType: AutomationRule['triggerType'],
    triggerColumnId: string,
  ): Promise<AutomationRule[]> {
    // Uses JSONB ->> operator to extract the columnId text field from trigger_config
    // and compare it to the destination column. Index on board_id keeps this fast.
    const result = await this.pool.query<RawRow>(
      `SELECT id, board_id, trigger_type, trigger_config, action_type, action_config, enabled, created_at
       FROM automation_rules
       WHERE board_id = $1
         AND trigger_type = $2
         AND enabled = true
         AND trigger_config->>'columnId' = $3`,
      [boardId, triggerType, triggerColumnId],
    );
    return result.rows.map(toRule);
  }

  async findEnabledByLabelTrigger(
    boardId: string,
    labelId: string,
  ): Promise<AutomationRule[]> {
    // Equivalent to findEnabledByTrigger but hard-codes 'card_label_assigned' and
    // queries the labelId key instead of columnId for the label-assign trigger type.
    const result = await this.pool.query<RawRow>(
      `SELECT id, board_id, trigger_type, trigger_config, action_type, action_config, enabled, created_at
       FROM automation_rules
       WHERE board_id = $1
         AND trigger_type = 'card_label_assigned'
         AND enabled = true
         AND trigger_config->>'labelId' = $2`,
      [boardId, labelId],
    );
    return result.rows.map(toRule);
  }

  /** Idempotently adds a label to a card. ON CONFLICT DO NOTHING means re-assigning
   *  an already-present label is a no-op rather than an error. */
  async assignLabel(cardId: string, labelId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [cardId, labelId],
    );
  }

  /**
   * Moves a card to a new column and appends it at the end of that column's
   * position sequence. Position is MAX(existing) + 1000, consistent with the
   * gap-based position strategy used throughout the codebase. Falls back to
   * position 1000 when the target column is empty (COALESCE handles null MAX).
   */
  async moveCardToColumn(cardId: string, columnId: string): Promise<void> {
    await this.pool.query(
      `UPDATE cards
       SET column_id  = $1,
           position   = COALESCE((SELECT MAX(position) FROM cards WHERE column_id = $1), 0) + 1000,
           updated_at = now()
       WHERE id = $2`,
      [columnId, cardId],
    );
  }
}
