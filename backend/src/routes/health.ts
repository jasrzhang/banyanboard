import { Router } from 'express';
import { HealthController } from '../controllers/HealthController.js';
import { HealthService } from '../services/HealthService.js';
import { HealthRepository } from '../repositories/HealthRepository.js';

const repository = new HealthRepository();
const service = new HealthService(repository);
const controller = new HealthController(service);

export const healthRouter = Router();
healthRouter.get('/live', controller.getLiveness);
healthRouter.get('/ready', controller.getReadiness);
