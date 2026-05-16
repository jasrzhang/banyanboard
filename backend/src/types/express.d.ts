import type { Logger, TraceContext } from './logger.js';

declare global {
  namespace Express {
    interface Request {
      logger: Logger;
      traceContext: TraceContext;
    }
  }
}

export {};
