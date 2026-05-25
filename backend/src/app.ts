import express, { type Application, type Request, type Response } from 'express';
import { healthRouter } from './routes/health.js';
import { boardsRouter } from './routes/boards.js';
import { columnsRouter } from './routes/columns.js';
import { cardsRouter } from './routes/cards.js';
import { activityRouter } from './routes/activity.js';
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
  app.use('/api/boards', boardsRouter);
  app.use('/api/boards', activityRouter);
  app.use('/api/columns', columnsRouter);
  app.use('/api/cards', cardsRouter);
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });
  app.use(errorHandler);
  return app;
}
