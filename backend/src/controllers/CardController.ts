import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { CardService } from '../services/CardService.js';
import { UpdateCardSchema } from '../schemas/cardSchemas.js';

const uuidParam = z.string().uuid();

export class CardController {
  constructor(private readonly service: CardService) {}

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

      const card = await this.service.updateCard(parsedId.data, parsedBody.data);
      if (!card) {
        res
          .status(404)
          .json({ error: { message: 'Card not found', traceId: req.traceContext.traceId } });
        return;
      }

      res.status(200).json(card);
    } catch (err) {
      next(err);
    }
  };
}
