import type { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import type { ActivityEvent, ActivityEventEmitter } from '../events/ActivityEventEmitter.js';

const uuidParam = z.string().uuid();

export class ActivitySSEController {
  constructor(private readonly emitter: ActivityEventEmitter) {}

  stream = (req: Request, res: Response): void => {
    const parsedId = uuidParam.safeParse(req.params['boardId']);
    if (!parsedId.success) {
      res.status(400).json({
        error: { message: 'Invalid board ID', traceId: req.traceContext.traceId },
      });
      return;
    }

    const boardId = parsedId.data;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Initial comment so the browser EventSource knows the stream is live
    res.write(': connected\n\n');

    req.logger.debug('SSE client connected', { boardId });

    const onActivity = (event: ActivityEvent): void => {
      if (event.boardId !== boardId) return;
      try {
        const id = `${boardId}-${Date.now()}`;
        res.write(`id: ${id}\ndata: ${JSON.stringify(event)}\n\n`);
      } catch (err) {
        req.logger.warn('SSE write to closed response attempted', { boardId, err });
      }
    };

    this.emitter.on(onActivity);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        // Connection closed; req.close cleanup will remove the listener
      }
    }, config.sse.heartbeatIntervalMs);

    req.on('close', () => {
      clearInterval(heartbeat);
      this.emitter.off(onActivity);
      req.logger.debug('SSE client disconnected', {
        boardId,
        listenersRemaining: this.emitter.listenerCount(),
      });
    });
  };
}
