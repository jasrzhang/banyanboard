import type { ErrorRequestHandler } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires 4-arg signature to recognise error handler middleware
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  const errObj = err instanceof Error ? err : new Error(String(err));

  req.logger.error('Unhandled request error', errObj, { route: req.path });

  res.status(500).json({
    error: {
      message,
      traceId: req.traceContext.traceId,
    },
  });
};
