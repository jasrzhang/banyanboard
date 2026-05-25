import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { ActivityService } from '../services/ActivityService.js';

const uuidParam = z.string().uuid();

export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  getActivity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedId = uuidParam.safeParse(req.params['boardId']);
      if (!parsedId.success) {
        res.status(400).json({
          error: { message: 'Invalid board ID', traceId: req.traceContext.traceId },
        });
        return;
      }

      const events = await this.service.getByBoardId(parsedId.data);
      res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  };
}
