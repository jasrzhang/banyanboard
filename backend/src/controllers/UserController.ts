import type { NextFunction, Request, Response } from 'express';
import { LoginSchema } from '../schemas/userSchemas.js';
import type { UserService } from '../services/UserService.js';

export class UserController {
  constructor(private readonly service: UserService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            message: 'Invalid request',
            issues: parsed.error.issues,
            traceId: req.traceContext.traceId,
          },
        });
        return;
      }

      const user = await this.service.login(parsed.data.firstName);
      res.status(201).json({ id: user.id, firstName: user.firstName });
    } catch (err) {
      next(err);
    }
  };
}
