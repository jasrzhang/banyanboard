export const up = (pgm) => {
  pgm.createTable('card_labels', {
    card_id: {
      type: 'uuid',
      notNull: true,
      references: '"cards"',
      onDelete: 'CASCADE',
    },
    label_id: {
      type: 'uuid',
      notNull: true,
      references: '"labels"',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('card_labels', 'card_labels_pk', 'PRIMARY KEY (card_id, label_id)');
};

export const down = (pgm) => {
  pgm.dropTable('card_labels');
};
