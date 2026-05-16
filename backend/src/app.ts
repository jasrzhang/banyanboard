import express, { type Application, type Request, type Response } from 'express';
import { healthRouter } from './routes/health.js';

/**
 * Express App Factory
 *
 * Creates and configures the Express application.
 * Separated into a factory function to enable:
 *   - Easy testing with supertest
 *   - Dependency injection of middleware/config (future phases)
 *   - Clear separation between app setup and server startup
 *
 * @returns Configured Express application ready to listen
 */
export function createApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/health', healthRouter);
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });
  return app;
}
