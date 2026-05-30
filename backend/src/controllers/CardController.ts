import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { CardService } from '../services/CardService.js';
import type { ActivityService } from '../services/ActivityService.js';
import type { AutomationService } from '../services/AutomationService.js';
import { UpdateCardSchema } from '../schemas/cardSchemas.js';

const uuidParam = z.string().uuid();

export class CardController {
  constructor(
    private readonly service: CardService,
    private readonly activityService: ActivityService,
    private readonly automationService: AutomationService,
  ) {}

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedId = uuidParam.safeParse(req.params['cardId']);
      if (!parsedId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid card ID', traceId: req.traceContext.traceId } });
        return;
      }

      const parsedBody = UpdateCardSchema.safeParse(req.body);
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

      // Capture pre-update context to detect move vs update
      const preCtx = await this.service.getCardContext(parsedId.data);

      const card = await this.service.updateCard(parsedId.data, parsedBody.data);
      if (!card) {
        res
          .status(404)
          .json({ error: { message: 'Card not found', traceId: req.traceContext.traceId } });
        return;
      }

      res.status(200).json(card);

      // Fire activity event and automation evaluation after responding (fire-and-forget)
      if (preCtx) {
        const isMove =
          parsedBody.data.columnId !== undefined && parsedBody.data.columnId !== preCtx.columnId;
        void this.activityService.recordEvent({
          boardId: preCtx.boardId,
          cardId: parsedId.data,
          eventType: isMove ? 'card_moved' : 'card_updated',
          payload: isMove
            ? { cardTitle: card.title, fromColumnId: preCtx.columnId, toColumnId: card.columnId }
            : { cardTitle: card.title },
        });

        if (isMove) {
          void this.automationService
            .evaluateCardMoved(preCtx.boardId, parsedId.data, card.columnId)
            .catch((err: unknown) =>
              req.logger.error('Automation evaluation unexpected error', {
                error: err instanceof Error ? err.message : String(err),
              }),
            );
        }
      }
    } catch (err) {
      next(err);
    }
  };
}
