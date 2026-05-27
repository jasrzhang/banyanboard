import { Router } from 'express';
import { pool } from '../config/db.js';
import { LabelRepository } from '../repositories/LabelRepository.js';
import { LabelService } from '../services/LabelService.js';
import { CardLabelController, LabelController } from '../controllers/LabelController.js';

const labelRepo = new LabelRepository(pool);
const service = new LabelService(labelRepo);
const labelController = new LabelController(service);
export const cardLabelController = new CardLabelController(service);

export const labelsRouter = Router({ mergeParams: true });
labelsRouter.get('/:boardId/labels', labelController.list);
labelsRouter.post('/:boardId/labels', labelController.create);
labelsRouter.patch('/:boardId/labels/:labelId', labelController.update);
labelsRouter.delete('/:boardId/labels/:labelId', labelController.delete);
