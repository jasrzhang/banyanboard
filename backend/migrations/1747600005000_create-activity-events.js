export const up = (pgm) => {
  pgm.createTable('activity_events', {
    id: { type: 'uuid', default: pgm.func('gen_random_uuid()'), primaryKey: true },
    board_id: {
      type: 'uuid',
      notNull: true,
      references: '"boards"',
      onDelete: 'CASCADE',
    },
    card_id: {
      type: 'uuid',
      references: '"cards"',
      onDelete: 'SET NULL',
    },
    event_type: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('activity_events', ['board_id', 'created_at'], {
    name: 'idx_activity_events_board_created',
    order: { created_at: 'DESC' },
  });
};

export const down = (pgm) => {
  pgm.dropIndex('activity_events', ['board_id', 'created_at'], {
    name: 'idx_activity_events_board_created',
  });
  pgm.dropTable('activity_events');
};
