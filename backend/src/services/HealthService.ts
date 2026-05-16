import { config } from '../config/env.js';
import type { HealthRepository } from '../repositories/HealthRepository.js';

interface LivenessResult {
  status: 'ok';
  uptime: number;
  version: string;
}

interface ReadinessResult {
  status: 'ok' | 'degraded';
  dbStatus: 'ok' | 'down';
}

export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  getLiveness(): LivenessResult {
    return {
      status: 'ok',
      uptime: process.uptime(),
      version: config.serviceVersion,
    };
  }

  async getReadiness(): Promise<ReadinessResult> {
    try {
      const alive = await this.repository.ping();
      return {
        status: alive ? 'ok' : 'degraded',
        dbStatus: alive ? 'ok' : 'down',
      };
    } catch {
      return { status: 'degraded', dbStatus: 'down' };
    }
  }
}
