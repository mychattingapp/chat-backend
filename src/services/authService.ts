import jwt from 'jsonwebtoken';
import { prisma } from '../config/prismaClient.js';
import { requireEnv } from '../config/env.js';
import type { Prisma, User } from '@prisma/client';
import type { AuthProvider } from '@prisma/client';
const refreshTokenTTL = Number(requireEnv('REFRESH_TOKEN_TTL'));
const accessTokenTTL = Number(requireEnv('ACCESS_TOKEN_TTL'));

export async function signAccessToken(userId: string) {
    return jwt.sign({ id: userId }, requireEnv('JWT_ACCESS_TOKEN_SECRET'), { expiresIn: accessTokenTTL / 1000 });
}

export async function signRefreshToken(userId: string) {
    return jwt.sign({ id: userId }, requireEnv('JWT_REFRESH_TOKEN_SECRET'), { expiresIn: refreshTokenTTL/1000 });
}

export async function storeRefreshToken(userId: string, refreshToken: string) {
    await prisma.auth.updateMany({
        where: {
            userId: userId
        },
        data: {
            refreshToken: refreshToken,
            tokenExpiry: new Date(Date.now() + refreshTokenTTL)
        }
    })
}

export async function findOrCreateUser(data: { providerId: string; provider: AuthProvider; email: string; username: string }): Promise<User> {

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {

        let userAuth = await tx.auth.findUnique({
            where: {
                provider_providerId: {
                    providerId: data.providerId,
                    provider: data.provider
                }
            },
            include: {
                user: true
            }
        });

        if (userAuth) {

            await tx.auth.update({
                where: {
                    id: userAuth.id
                },
                data: {
                    email: data.email,
                }
            });
            return userAuth.user;
        }

        let user = await tx.user.findUnique({
            where: {
                email: data.email
            }
        });

        if (!user) {
            user = await tx.user.create({
                data: {
                    email: data.email,
                    username: data.username
                }
            });
        }

        await tx.auth.create({
            data: {
                providerId: data.providerId,
                provider: data.provider,
                email: data.email,
                userId: user.id
            }
        })

        return user;
    });
}

export async function clearRefreshToken(userId: string) {
    await prisma.auth.updateMany({
        where: {
            userId: userId
        },
        data: {
            refreshToken: null,
            tokenExpiry: null
        }
    });
}

export async function clearRefreshTokenByValue(refreshToken: string) {
    await prisma.auth.updateMany({
        where: {
            refreshToken: refreshToken,
        },
        data: {
            refreshToken: null,
            tokenExpiry: null,
        }
    });
}

export async function refreshSession(refreshToken: string) {

    let decoded;
    try {
        const tokenPayload = jwt.verify(refreshToken, requireEnv('JWT_REFRESH_TOKEN_SECRET'));
        if (typeof tokenPayload !== 'object' || tokenPayload === null || !('id' in tokenPayload)) {
            throw new Error('Invalid refresh token');
        }
        decoded = tokenPayload as { id: string };
    }
    catch (error) {
        throw new Error('Invalid refresh token');
    }

    const authRecord = await prisma.auth.findFirst({
        where: {
            refreshToken: refreshToken
        },
    });

    if (!authRecord) {
        throw new Error('Session not found');
    }

    if (authRecord.tokenExpiry && authRecord.tokenExpiry < new Date()) {
        await clearRefreshTokenByValue(refreshToken);
        throw new Error('Refresh token expired');
    }

    const userId = decoded.id;
    const newAccessToken = await signAccessToken(userId);
    const newRefreshToken = await signRefreshToken(userId);

    await storeRefreshToken(userId, newRefreshToken);

    return ({
        newAccessToken: newAccessToken,
        newRefreshToken: newRefreshToken,
    })
}