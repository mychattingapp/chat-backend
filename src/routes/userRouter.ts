import { Router } from 'express';
import { handleGetUser, handleUpdateCurrentUser } from '../controllers/userController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authed } from '../middleware/authed.js';

export const userRouter = Router();

userRouter.get('/me', authenticateToken, authed(handleGetUser));
userRouter.patch('/me', authenticateToken, authed(handleUpdateCurrentUser));
