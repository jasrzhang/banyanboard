import { Router } from 'express';
import { pool } from '../config/db.js';
import { CardRepository } from '../repositories/CardRepository.js';
import { CardService } from '../services/CardService.js';
import { CardController } from '../controllers/CardController.js';
import { activityService } from './activity.js';
import { automationService } from './automations.js';
import { cardLabelController } from './labels.js';

const cardRepo = new CardRepository(pool);
const service = new CardService(cardRepo);
const controller = new CardController(service, activityService, automationService);

export const cardsRouter = Router();
cardsRouter.patch('/:cardId', controller.update);
cardsRouter.put('/:cardId/labels', cardLabelController.replace);
