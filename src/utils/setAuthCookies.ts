import type { Response } from 'express';
import { accessCookieOptions, refreshCookieOptions } from '../config/cookies.js';

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie('access_token', accessToken, accessCookieOptions);
    res.cookie('refresh_token', refreshToken, refreshCookieOptions);
}
