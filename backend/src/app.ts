import express, { type Application } from 'express';

/**
 * Express App Factory
 *
 * Creates and configures the Express application.
 * Separated into a factory function to enable:
 *   - Easy testing with supertest
 *   - Dependency injection of middleware/config (future phases)
 *   - Clear separation between app setup and server startup
 *
 * Currently sets up JSON request parsing; route handlers added in Phase 2.
 *
 * @returns Configured Express application ready to listen
 */
export function createApp(): Application {
  const app = express();
  app.use(express.json());
  // Routes will be registered in Phase 2: POST /api/boards, GET /api/boards/:id, etc.
  return app;
}
