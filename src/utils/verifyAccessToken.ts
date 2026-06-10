import jwt from 'jsonwebtoken';
import { requireEnv } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

export function verifyAccessToken(token: string): string {
    try {
        const tokenPayload = jwt.verify(token, requireEnv('JWT_ACCESS_TOKEN_SECRET'));

        if (
            typeof tokenPayload !== 'object'
            || tokenPayload === null
            || !('id' in tokenPayload)
            || typeof tokenPayload.id !== 'string'
        ) {
            throw new AppError(
                "Invalid token",
                "INVALID_TOKEN",
                401
            );
        }

        return tokenPayload.id;
    }
    catch {
        throw new AppError(
            "Invalid token",
            "INVALID_TOKEN",
            401
        );
    }
}
