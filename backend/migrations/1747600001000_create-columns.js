export const up = (pgm) => {
  pgm.createTable('columns', {
    id: { type: 'uuid', default: pgm.func('gen_random_uuid()'), primaryKey: true },
    board_id: {
      type: 'uuid',
      notNull: true,
      references: '"boards"',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    position: { type: 'integer', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('columns', 'columns_board_id_position_unique', 'UNIQUE (board_id, position)');
};

export const down = (pgm) => {
  pgm.dropTable('columns');
};
