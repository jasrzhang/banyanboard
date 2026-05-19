// Seeds development database with demo board, columns, cards, and labels.
import 'dotenv/config';
import { pool } from '../config/db.js';
import { rootLogger } from '../config/logger.js';

const DEFAULT_LABELS = [
  { name: 'bug', color: '#be123c' },
  { name: 'feature', color: '#047857' },
  { name: 'frontend', color: '#0369a1' },
  { name: 'backend', color: '#6d28d9' },
];

const DEFAULT_COLUMNS = [
  { name: 'To Do', position: 1 },
  { name: 'In Progress', position: 2 },
  { name: 'Done', position: 3 },
];

async function seed(): Promise<void> {
  const logger = rootLogger.child({ script: 'seed' });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if board already exists
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM boards WHERE name = 'My First Board' LIMIT 1"
    );
    if (existing.rows.length > 0) {
      logger.info('Seed data already exists — skipping', { boardId: existing.rows[0]?.id });
      await client.query('ROLLBACK');
      return;
    }

    // Create board
    const boardResult = await client.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('My First Board') RETURNING id"
    );
    const boardId = boardResult.rows[0]?.id;
    if (!boardId) throw new Error('Failed to insert board');
    logger.info('Created board', { boardId });

    // Create labels
    const labelIds: Record<string, string> = {};
    for (const label of DEFAULT_LABELS) {
      const labelResult = await client.query<{ id: string }>(
        'INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING id',
        [boardId, label.name, label.color]
      );
      const labelId = labelResult.rows[0]?.id;
      if (!labelId) throw new Error(`Failed to insert label ${label.name}`);
      labelIds[label.name] = labelId;
    }
    logger.info('Created labels', { count: DEFAULT_LABELS.length });

    // Create columns
    const columnIds: Record<string, string> = {};
    for (const col of DEFAULT_COLUMNS) {
      const colResult = await client.query<{ id: string }>(
        'INSERT INTO columns (board_id, name, position) VALUES ($1, $2, $3) RETURNING id',
        [boardId, col.name, col.position]
      );
      const colId = colResult.rows[0]?.id;
      if (!colId) throw new Error(`Failed to insert column ${col.name}`);
      columnIds[col.name] = colId;
    }
    logger.info('Created columns', { count: DEFAULT_COLUMNS.length });

    // Create cards
    const todoColId = columnIds['To Do'];
    const inProgressColId = columnIds['In Progress'];
    const doneColId = columnIds['Done'];
    if (!todoColId || !inProgressColId || !doneColId) throw new Error('Column IDs missing');

    const cards = [
      { columnId: todoColId, title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment.', position: 1000, labels: ['backend'] },
      { columnId: todoColId, title: 'Write API documentation', description: 'Document all REST endpoints using OpenAPI spec.', position: 2000, labels: ['backend'] },
      { columnId: inProgressColId, title: 'Fix login bug', description: 'Users are occasionally logged out after 30 minutes instead of the expected 24 hours. Investigate session token expiry logic.', position: 1000, labels: ['bug', 'backend'] },
      { columnId: inProgressColId, title: 'Implement drag-and-drop', description: 'Use dnd-kit to enable card reordering across columns.', position: 2000, labels: ['feature', 'frontend'] },
      { columnId: doneColId, title: 'Design system setup', description: 'Configured TailwindCSS with semantic design tokens.', position: 1000, labels: ['frontend'] },
    ];

    for (const card of cards) {
      const cardResult = await client.query<{ id: string }>(
        'INSERT INTO cards (column_id, title, description, position) VALUES ($1, $2, $3, $4) RETURNING id',
        [card.columnId, card.title, card.description, card.position]
      );
      const cardId = cardResult.rows[0]?.id;
      if (!cardId) throw new Error(`Failed to insert card: ${card.title}`);

      for (const labelName of card.labels) {
        const labelId = labelIds[labelName];
        if (labelId) {
          await client.query(
            'INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)',
            [cardId, labelId]
          );
        }
      }
    }
    logger.info('Created cards with labels', { count: cards.length });

    await client.query('COMMIT');
    logger.info('Seed complete');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Seed failed', err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  process.stderr.write(`Seed failed: ${String(err)}\n`);
  process.exit(1);
});
