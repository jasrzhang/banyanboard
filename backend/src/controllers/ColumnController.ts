import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { ColumnService } from '../services/ColumnService.js';
import { CreateCardSchema } from '../schemas/cardSchemas.js';

const uuidParam = z.string().uuid();

export class ColumnController {
  constructor(private readonly service: ColumnService) {}

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
    } catch (err) {
      next(err);
    }
  };
}
