import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest } from '../types/express.js';

export function authed(
  fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown | Promise<unknown>
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
      }

      await fn(req as AuthenticatedRequest, res, next);
    } catch (err) {
      next(err);
    }
  };
}
