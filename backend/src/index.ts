/**
 * Server Entry Point
 *
 * Loads configuration, verifies DB connectivity, creates the Express app,
 * and starts the HTTP server. Handles graceful shutdown on SIGTERM / SIGINT.
 *
 * Exit behavior:
 *   - ConfigurationError or DB unreachable: Process exits with code 1 (before server starts)
 *   - SIGTERM/SIGINT: Server closes, pool drains, process exits with code 0
 */

import { config } from './config/env.js';
import { createApp } from './app.js';
import { checkDatabaseConnection, closePool } from './config/db.js';

async function start(): Promise<void> {
  await checkDatabaseConnection().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Database connectivity check failed:', err);
    process.exit(1);
  });

  const app = createApp();

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${config.port}`);
  });

  let shuttingDown = false;
  function gracefulShutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

start().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected startup error:', err);
  process.exit(1);
});
