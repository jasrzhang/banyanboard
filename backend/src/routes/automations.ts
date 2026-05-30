import { Router } from 'express';
import { pool } from '../config/db.js';
import { AutomationRepository } from '../repositories/AutomationRepository.js';
import { AutomationService } from '../services/AutomationService.js';
import { AutomationController } from '../controllers/AutomationController.js';
import { activityService } from './activity.js';
import { rootLogger } from '../config/logger.js';

const automationRepo = new AutomationRepository(pool);

// Export the singleton so CardController and CardLabelController can import it
// without creating separate instances. Mirrors the activityService singleton
// pattern established in routes/activity.ts.
export const automationService = new AutomationService(
  automationRepo,
  activityService,
  rootLogger,
);
const automationController = new AutomationController(automationService);

// mergeParams: true is required so /:boardId is visible to sub-routes when
// this router is mounted at app.use('/api/boards', automationsRouter).
export const automationsRouter = Router({ mergeParams: true });
automationsRouter.get('/:boardId/automations', automationController.list);
automationsRouter.post('/:boardId/automations', automationController.create);
automationsRouter.delete('/:boardId/automations/:ruleId', automationController.remove);
