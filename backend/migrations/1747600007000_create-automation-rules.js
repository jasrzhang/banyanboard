export const up = (pgm) => {
  // trigger_config and action_config are JSONB rather than typed columns so
  // new trigger/action types can be added without schema migrations. The
  // application layer (AutomationRepository) extracts well-known keys
  // (columnId, labelId) at runtime and validates them via Zod on write.
  pgm.createTable('automation_rules', {
    id: { type: 'uuid', default: pgm.func('gen_random_uuid()'), primaryKey: true },
    board_id: {
      type: 'uuid',
      notNull: true,
      references: '"boards"',
      onDelete: 'CASCADE',
    },
    trigger_type: { type: 'text', notNull: true },
    trigger_config: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    action_type: { type: 'text', notNull: true },
    action_config: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    enabled: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  // Board-scoped queries (list, evaluate) always filter by board_id first.
  pgm.createIndex('automation_rules', ['board_id'], {
    name: 'idx_automation_rules_board_id',
  });
};

export const down = (pgm) => {
  pgm.dropIndex('automation_rules', ['board_id'], {
    name: 'idx_automation_rules_board_id',
  });
  pgm.dropTable('automation_rules');
};
