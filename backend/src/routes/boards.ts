import { Router } from 'express';
import { pool } from '../config/db.js';
import { BoardRepository } from '../repositories/BoardRepository.js';
import { BoardService } from '../services/BoardService.js';
import { BoardController } from '../controllers/BoardController.js';

const boardRepo = new BoardRepository(pool);
const service = new BoardService(boardRepo);
const controller = new BoardController(service);

export const boardsRouter = Router();
boardsRouter.get('/', controller.list);
boardsRouter.get('/:id', controller.getById);
