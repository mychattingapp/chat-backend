import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/express.js';
import { signAccessToken, signRefreshToken, clearRefreshToken, clearRefreshTokenByValue, refreshSession, storeRefreshToken } from '../services/authService.js';
import { findUser } from '../services/userService.js';
import { setAuthCookies } from '../utils/setAuthCookies.js';
import { requireEnv } from '../config/env.js';
import { accessCookieOptions, refreshCookieOptions } from '../config/cookies.js';

export async function authCallback(req: Request, res: Response) {

    const user = req.user;
    if (!user) {
        return res.status(401).json({
            success: false,
            error: {
                code: "AUTHENTICATION_FAILED",
                message: "Authentication failed"
            }
        });
    }

    const { id } = user;
    const accessToken = await signAccessToken(id);
    const refreshToken = await signRefreshToken(id);

    await storeRefreshToken(id, refreshToken);

    setAuthCookies(res, accessToken, refreshToken);

    return res.redirect(`${requireEnv('CLIENT_URL')}`);
}

export async function refreshAccessToken(req: Request, res: Response) {

    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) {
        return res.status(401).json({
            success: false,
            error: {
                code: "NO_REFRESH_TOKEN",
                message: "No refresh token provided"
            }
        });
    }

    try {
        const { newAccessToken, newRefreshToken } = await refreshSession(refreshToken);
        setAuthCookies(res, newAccessToken, newRefreshToken);
        return res.status(200).json({
            success: true,
            data: {
                message: "Tokens refreshed successfully"
            }
        });
    }
    catch (error) {
        res.clearCookie('access_token', accessCookieOptions);
        res.clearCookie('refresh_token', refreshCookieOptions);
        return res.status(401).json({
            success: false,
            error: {
                code: "TOKEN_REFRESH_FAILED",
                message: error instanceof Error ? error.message : "Token refresh failed"
            }
        });
    }
}

export async function fetchUserData(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const userObject = await findUser(userId);

    if (!userObject) {
        return res.status(404).json({
            success: false,
            error: {
                code: "USER_NOT_FOUND",
                message: "User not found"
            }
        });
    }

    const userData = {
        id: userObject.id,
        name: userObject.username,
        email: userObject.email,
        profileImageUrl: userObject.profileImageUrl,
        updatedAt: userObject.updatedAt
    };

    return res.status(200).json({
        success: true,
        data: {
            user: userData
        }
    });
}

export async function logoutUser(req: Request, res: Response) {
    const user = req.user;
    const refreshToken = req.cookies?.['refresh_token'];

    res.clearCookie('access_token', accessCookieOptions);
    res.clearCookie('refresh_token', refreshCookieOptions);


    if (user?.id) {
        await clearRefreshToken(user.id);
    }
    else if (refreshToken) {
        await clearRefreshTokenByValue(refreshToken);
    }

    return res.status(200).json({
        success: true,
        data: {
            message: "Logged out successfully"
        }
    });
}

export async function redirectToClient(req: Request, res: Response) {
    const preferred = req.accepts(['html', 'json']);
    if (preferred === 'json') {
        return res.status(401).json({
            success: false,
            error: {
                code: "AUTHENTICATION_FAILED",
                message: "Authentication failed"
            }
        });
    }

    const clientUrl = requireEnv('CLIENT_URL');
    const url = new URL(clientUrl);
    url.pathname = '/login';
    url.searchParams.set('error', 'oauth_failed');
    return res.redirect(url.toString());
}
