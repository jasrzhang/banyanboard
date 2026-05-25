import { Router } from 'express';
import { pool } from '../config/db.js';
import { activityEmitter } from '../events/ActivityEventEmitter.js';
import { ActivityRepository } from '../repositories/ActivityRepository.js';
import { ActivityService } from '../services/ActivityService.js';
import { ActivityController } from '../controllers/ActivityController.js';
import { ActivitySSEController } from '../controllers/ActivitySSEController.js';

const activityRepo = new ActivityRepository(pool);
export const activityService = new ActivityService(activityRepo, activityEmitter);
const activityController = new ActivityController(activityService);
const activitySSEController = new ActivitySSEController(activityEmitter);

export const activityRouter = Router({ mergeParams: true });
activityRouter.get('/:boardId/activity', activityController.getActivity);
activityRouter.get('/:boardId/activity-stream', activitySSEController.stream);
