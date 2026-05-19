export const up = (pgm) => {
  pgm.createTable('boards', {
    id: { type: 'uuid', default: pgm.func('gen_random_uuid()'), primaryKey: true },
    name: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

export const down = (pgm) => {
  pgm.dropTable('boards');
};
