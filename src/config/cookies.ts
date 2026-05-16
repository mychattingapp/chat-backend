import type { CookieOptions } from 'express';
import { requireEnv } from './env.js';

const isProd = requireEnv('NODE_ENV') === 'production';

const accessCookieOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: Number(requireEnv('ACCESS_TOKEN_TTL')),
};

const refreshCookieOptions: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: Number(requireEnv('REFRESH_TOKEN_TTL')),
    path: '/api/auth'
};

export { accessCookieOptions, refreshCookieOptions };
