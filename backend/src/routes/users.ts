import { Router } from 'express';
import { pool } from '../config/db.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { UserService } from '../services/UserService.js';
import { UserController } from '../controllers/UserController.js';

const repo = new UserRepository(pool);
const service = new UserService(repo);
const controller = new UserController(service);

export const usersRouter = Router();
usersRouter.post('/login', controller.login);
