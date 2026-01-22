import type { User } from '@prisma/client';
import { prisma } from '../config/prismaClient.js';

export async function findUser(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
        where: {
            id
        }
    });
    return user;
}