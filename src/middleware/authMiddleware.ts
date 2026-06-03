import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireEnv } from '../config/env.js';

export function authenticateToken(req: Request, res: Response, next: NextFunction) {

    const token = req.cookies['access_token'];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: {
                code: "NO_TOKEN_PROVIDED",
                message: "No token provided"
            }
        });
    }

    const secret = requireEnv('JWT_ACCESS_TOKEN_SECRET');

    try {
        const tokenPayload = jwt.verify(token, secret);
        if (typeof tokenPayload !== 'object' || tokenPayload === null || !('id' in tokenPayload)) {
            return res.status(401).json({
                success: false,
                error: {
                    code: "INVALID_TOKEN",
                    message: "Invalid token"
                }
            });
        }

        const { id } = tokenPayload as { id: string };
        req.user = { id };

        next();
    }
    catch (err) {
        return res.status(401).json({
            success: false,
            error: {
                code: "INVALID_TOKEN",
                message: "Invalid token"
            }
        });
    }

}

