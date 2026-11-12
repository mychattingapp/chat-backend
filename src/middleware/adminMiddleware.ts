import type { RequestHandler } from 'express';
import { prisma } from '../config/prismaClient.js';
import { AppError } from '../errors/AppError.js';

export const requireAdmin: RequestHandler = async (req, _res, next) => {
    try {
        if (!req.user) throw new AppError('Sign in required', 'NOT_AUTHENTICATED', 401);
        const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
        if (user?.role !== 'ADMIN') throw new AppError('Admin access required', 'ADMIN_REQUIRED', 403);
        next();
    } catch (error) {
        next(error);
    }
};
