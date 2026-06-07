import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/verifyAccessToken.js';
import { AppError } from '../errors/AppError.js';

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
    try {
        const token = req.cookies['access_token'];
        if (!token) {
            return next(new AppError("No token provided", "NO_TOKEN_PROVIDED", 401));
        }

        const userId = verifyAccessToken(token);
        req.user = { id: userId };
        next();
    }
    catch (err) {
        next(err);
    }
}

