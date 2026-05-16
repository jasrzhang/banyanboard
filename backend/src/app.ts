import express, { type Application, type Request, type Response } from 'express';
import { healthRouter } from './routes/health.js';
import { rootLogger } from './config/logger.js';
import { createRequestContext } from './middleware/requestContext.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Application {
  const app = express();
  app.use(createRequestContext(rootLogger));
  app.use(requestLogger);
  app.use(express.json());
  app.use('/health', healthRouter);
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });
  app.use(errorHandler);
  return app;
}
