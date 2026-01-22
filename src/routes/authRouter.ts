import { Router } from 'express';
import passport from 'passport';
import { authCallback, fetchUserData, refreshAccessToken, logoutUser, redirectToClient } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authed } from '../middleware/authed.js';

export const authRouter = Router();

authRouter.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

authRouter.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/auth/failure' }),
    authCallback
);

authRouter.get('/me', authenticateToken, authed(fetchUserData));

authRouter.post('/logout', logoutUser);

authRouter.get('/refresh', refreshAccessToken);

authRouter.get('/failure', redirectToClient);