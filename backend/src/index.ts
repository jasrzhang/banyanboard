/**
 * Server Entry Point
 *
 * Loads configuration, creates the Express app, and starts the HTTP server.
 * Handles graceful shutdown on SIGTERM (container stop) and SIGINT (Ctrl+C).
 *
 * Exit behavior:
 *   - ConfigurationError: Process exits with code 1 (before server starts)
 *   - SIGTERM/SIGINT: Server closes cleanly, process exits with code 0
 */

import { config } from './config/env.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(config.port, () => {
  // TODO: Replace console.log with pino logger when Phase 5 wires observability
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${config.port}`);
});

/**
 * Graceful shutdown handler.
 * Called on SIGTERM (container orchestration) or SIGINT (Ctrl+C).
 * Closes the HTTP server and exits the process.
 */
function gracefulShutdown(): void {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
