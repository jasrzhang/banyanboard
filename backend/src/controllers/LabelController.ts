import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { LabelService } from '../services/LabelService.js';
import { DuplicateLabelError } from '../services/LabelService.js';
import { CreateLabelSchema, UpdateLabelSchema } from '../schemas/labelSchemas.js';

const uuidParam = z.string().uuid();

export class LabelController {
  constructor(private readonly service: LabelService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedBoardId = uuidParam.safeParse(req.params['boardId']);
      if (!parsedBoardId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid board ID', traceId: req.traceContext.traceId } });
        return;
      }

      const labels = await this.service.listForBoard(parsedBoardId.data);
      res.status(200).json(labels);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedBoardId = uuidParam.safeParse(req.params['boardId']);
      if (!parsedBoardId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid board ID', traceId: req.traceContext.traceId } });
        return;
      }

      const parsedBody = CreateLabelSchema.safeParse(req.body);
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

      const label = await this.service.createLabel({
        boardId: parsedBoardId.data,
        ...parsedBody.data,
      });
      res.status(201).json(label);
    } catch (err) {
      if (err instanceof DuplicateLabelError) {
        res.status(409).json({
          error: {
            message: 'A label with this name already exists',
            traceId: req.traceContext.traceId,
          },
        });
        return;
      }
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedBoardId = uuidParam.safeParse(req.params['boardId']);
      if (!parsedBoardId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid board ID', traceId: req.traceContext.traceId } });
        return;
      }

      const parsedLabelId = uuidParam.safeParse(req.params['labelId']);
      if (!parsedLabelId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid label ID', traceId: req.traceContext.traceId } });
        return;
      }

      const parsedBody = UpdateLabelSchema.safeParse(req.body);
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

      const label = await this.service.updateLabel(
        parsedBoardId.data,
        parsedLabelId.data,
        parsedBody.data,
      );
      if (!label) {
        res
          .status(404)
          .json({ error: { message: 'Label not found', traceId: req.traceContext.traceId } });
        return;
      }

      res.status(200).json(label);
    } catch (err) {
      if (err instanceof DuplicateLabelError) {
        res.status(409).json({
          error: {
            message: 'A label with this name already exists',
            traceId: req.traceContext.traceId,
          },
        });
        return;
      }
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedBoardId = uuidParam.safeParse(req.params['boardId']);
      if (!parsedBoardId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid board ID', traceId: req.traceContext.traceId } });
        return;
      }

      const parsedLabelId = uuidParam.safeParse(req.params['labelId']);
      if (!parsedLabelId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid label ID', traceId: req.traceContext.traceId } });
        return;
      }

      const deleted = await this.service.deleteLabel(parsedBoardId.data, parsedLabelId.data);
      if (!deleted) {
        res
          .status(404)
          .json({ error: { message: 'Label not found', traceId: req.traceContext.traceId } });
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
