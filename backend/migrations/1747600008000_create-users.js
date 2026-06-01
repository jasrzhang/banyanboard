export const up = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'uuid', default: pgm.func('gen_random_uuid()'), primaryKey: true },
    first_name: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

export const down = (pgm) => {
  pgm.dropTable('users');
};
