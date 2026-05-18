import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { BoardService } from '../services/BoardService.js';

const uuidParam = z.string().uuid();

export class BoardController {
  constructor(private readonly service: BoardService) {}

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const boards = await this.service.listBoards();
      res.status(200).json(boards);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = uuidParam.safeParse(req.params['id']);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid board ID', traceId: req.traceContext.traceId } });
        return;
      }

      const board = await this.service.getBoard(parsed.data);
      if (!board) {
        res
          .status(404)
          .json({ error: { message: 'Board not found', traceId: req.traceContext.traceId } });
        return;
      }

      res.status(200).json(board);
    } catch (err) {
      next(err);
    }
  };
}
