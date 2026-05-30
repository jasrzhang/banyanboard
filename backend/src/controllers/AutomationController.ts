import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { AutomationService } from '../services/AutomationService.js';
import { CircularRuleError, NotFoundError } from '../services/AutomationService.js';
import { CreateAutomationRuleSchema } from '../schemas/automationSchemas.js';

const uuidParam = z.string().uuid();

export class AutomationController {
  constructor(private readonly service: AutomationService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedBoardId = uuidParam.safeParse(req.params['boardId']);
      if (!parsedBoardId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid board ID', traceId: req.traceContext.traceId } });
        return;
      }

      const rules = await this.service.listByBoard(parsedBoardId.data);
      res.status(200).json(rules);
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

      const parsedBody = CreateAutomationRuleSchema.safeParse(req.body);
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

      const rule = await this.service.createRule(parsedBoardId.data, parsedBody.data);
      res.status(201).json(rule);
    } catch (err) {
      if (err instanceof CircularRuleError) {
        res.status(422).json({
          code: 'CIRCULAR_RULE_DETECTED',
          message: err.message,
          details: [],
        });
        return;
      }
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedBoardId = uuidParam.safeParse(req.params['boardId']);
      if (!parsedBoardId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid board ID', traceId: req.traceContext.traceId } });
        return;
      }

      const parsedRuleId = uuidParam.safeParse(req.params['ruleId']);
      if (!parsedRuleId.success) {
        res
          .status(400)
          .json({ error: { message: 'Invalid rule ID', traceId: req.traceContext.traceId } });
        return;
      }

      await this.service.deleteRule(parsedBoardId.data, parsedRuleId.data);
      res.status(204).send();
    } catch (err) {
      if (err instanceof NotFoundError) {
        res
          .status(404)
          .json({ error: { message: 'Automation rule not found', traceId: req.traceContext.traceId } });
        return;
      }
      next(err);
    }
  };
}
