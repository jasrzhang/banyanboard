import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { Logger } from '../types/logger.js';
import type { TraceContext } from '../types/logger.js';

const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

function parseTraceparent(header: string): TraceContext | null {
  const match = TRACEPARENT_RE.exec(header);
  if (!match) return null;
  return { traceId: match[1] as string, spanId: match[2] as string };
}

function formatTraceparent(tc: TraceContext): string {
  return `00-${tc.traceId}-${tc.spanId}-00`;
}

export function createRequestContext(logger: Logger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawHeader = req.headers['traceparent'];
    const parsed = typeof rawHeader === 'string' ? parseTraceparent(rawHeader) : null;

    const traceContext: TraceContext = parsed ?? {
      traceId: randomBytes(16).toString('hex'),
      spanId: randomBytes(8).toString('hex'),
    };

    req.traceContext = traceContext;
    req.logger = logger.withTraceContext(traceContext);
    res.setHeader('traceparent', formatTraceparent(traceContext));
    next();
  };
}
