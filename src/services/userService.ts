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

export async function getUserByAnyEmail(emailId: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                {
                    email: emailId
                },
                {
                    auths: {
                        some: {
                            email: emailId
                        }
                    }
                }
            ]
        }
    });
    return user;
}