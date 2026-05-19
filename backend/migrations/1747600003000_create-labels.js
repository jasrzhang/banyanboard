export const up = (pgm) => {
  pgm.createTable('labels', {
    id: { type: 'uuid', default: pgm.func('gen_random_uuid()'), primaryKey: true },
    board_id: {
      type: 'uuid',
      notNull: true,
      references: '"boards"',
      onDelete: 'CASCADE',
    },
    name: { type: 'text', notNull: true },
    color: { type: 'text', notNull: true },
  });
  pgm.addConstraint('labels', 'labels_board_id_name_unique', 'UNIQUE (board_id, name)');
};

export const down = (pgm) => {
  pgm.dropTable('labels');
};
