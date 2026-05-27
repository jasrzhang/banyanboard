export const up = (pgm) => {
  pgm.addColumns('labels', {
    icon: { type: 'VARCHAR(10)', notNull: false },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('labels', ['icon']);
};
