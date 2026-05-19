export const up = (pgm) => {
  pgm.createTable('cards', {
    id: { type: 'uuid', default: pgm.func('gen_random_uuid()'), primaryKey: true },
    column_id: {
      type: 'uuid',
      notNull: true,
      references: '"columns"',
      onDelete: 'CASCADE',
    },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    due_date: { type: 'date' },
    position: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('cards', ['column_id', 'position'], { name: 'idx_cards_column_position' });
};

export const down = (pgm) => {
  pgm.dropIndex('cards', ['column_id', 'position'], { name: 'idx_cards_column_position' });
  pgm.dropTable('cards');
};
