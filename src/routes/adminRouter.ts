import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/adminMiddleware.js';
import { handleActivity, handleSignups, handleOverview, handleUser, handleUsers } from '../controllers/adminController.js';

export const adminRouter = Router();
adminRouter.use(authenticateToken, requireAdmin);
adminRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
adminRouter.get('/overview', handleOverview);
adminRouter.get('/messages', handleActivity);
adminRouter.get('/signups', handleSignups);
adminRouter.get('/users', handleUsers);
adminRouter.get('/users/:userId', handleUser);
adminRouter.get('/users/:userId/messages', handleActivity);
