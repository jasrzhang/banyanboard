import type { Request, Response } from 'express';
import type { HealthService } from '../services/HealthService.js';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  getLiveness = (_req: Request, res: Response): void => {
    res.status(200).json(this.healthService.getLiveness());
  };

  getReadiness = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.healthService.getReadiness();
      res.status(result.status === 'ok' ? 200 : 503).json(result);
    } catch {
      res.status(503).json({ status: 'degraded', dbStatus: 'down' });
    }
  };
}
