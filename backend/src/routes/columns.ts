import { Router } from 'express';
import { pool } from '../config/db.js';
import { ColumnRepository } from '../repositories/ColumnRepository.js';
import { CardRepository } from '../repositories/CardRepository.js';
import { ColumnService } from '../services/ColumnService.js';
import { ColumnController } from '../controllers/ColumnController.js';

const columnRepo = new ColumnRepository(pool);
const cardRepo = new CardRepository(pool);
const service = new ColumnService(columnRepo, cardRepo);
const controller = new ColumnController(service);

export const columnsRouter = Router();
columnsRouter.post('/:columnId/cards', controller.createCard);
