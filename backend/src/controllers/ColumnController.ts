import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { ColumnService } from '../services/ColumnService.js';
import type { ActivityService } from '../services/ActivityService.js';
import { CreateCardSchema } from '../schemas/cardSchemas.js';

const uuidParam = z.string().uuid();

export class ColumnController {
  constructor(
    private readonly service: ColumnService,
    private readonly activityService: ActivityService,
  ) {}

  createCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedId = uuidParam.safeParse(req.params['columnId']);
      if (!parsedId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid column ID', traceId: req.traceContext.traceId } });
        return;
      }

      const parsedBody = CreateCardSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json({
          error: {
            message: 'Invalid request',
            issues: parsedBody.error.issues,
            traceId: req.traceContext.traceId,
          },
        });
        return;
      }

      const card = await this.service.createCard(parsedId.data, parsedBody.data);
      if (!card) {
        res
          .status(404)
          .json({ error: { message: 'Column not found', traceId: req.traceContext.traceId } });
        return;
      }

      res.status(201).json(card);

      // Fire activity event after responding (fire-and-forget)
      void this.service.getColumnInfo(parsedId.data)
        .then((colInfo) => {
          if (!colInfo) return;
          return this.activityService.recordEvent({
            boardId: colInfo.boardId,
            cardId: card.id,
            eventType: 'card_created',
            payload: { cardTitle: card.title, columnName: colInfo.name },
          });
        })
        .catch((err: unknown) => {
          req.logger.warn('card_created activity hook failed', { cardId: card.id, err });
        });
    } catch (err) {
      next(err);
    }
  };
}
