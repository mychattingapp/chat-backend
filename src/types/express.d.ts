import type { Request } from 'express';

declare global {
  namespace Express {
    interface User {
      id: string;
    }

    interface Request {
      user?: User;
      cookies?: Record<string, string>;
      signedCookies?: Record<string, string>;
    }
  }
}

export type AuthenticatedRequest = Request & { user: Express.User };

export {};