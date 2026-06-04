import { ChatType } from "@prisma/client";
import { prisma } from "../config/prismaClient.js";
import { AppError } from "../errors/AppError.js";
import type { ChatWithDetails } from "../types/chat.js";

function makeDirectKey(user1Id: string, user2Id: string): string {
    const [friend1, friend2] = [user1Id, user2Id].sort() as [string, string];
    return `${friend1}:${friend2}`;
}

export async function createDirectChat(user1Id: string, user2Id: string): Promise<ChatWithDetails> {
    const directKey = makeDirectKey(user1Id, user2Id);

    return await prisma.chat.upsert({
        where: {
            directKey
        },
        update: {},
        create: {
            chatType: ChatType.DIRECT,
            directKey,
            participants: {
                create: [
                    { userId: user1Id },
                    { userId: user2Id }
                ]
            }
        },
        include: {
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    }
                }
            },
            lastMessage: {
                select: {
                    id: true,
                    text: true,
                    createdAt: true,
                    senderId: true,
                }
            }
        }
    });
}

export async function getAllChats(userId: string, chatType: ChatType): Promise<ChatWithDetails[]> {
    return await prisma.chat.findMany({
        where: {
            participants: {
                some: {
                    userId: userId
                }
            },
            chatType: chatType
        },
        include: {
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    }
                }
            },
            lastMessage: {
                select: {
                    id: true,
                    text: true,
                    createdAt: true,
                    senderId: true
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });
}

export async function getSingleChat(userId: string, chatId: string): Promise<ChatWithDetails | null> {
    return await prisma.chat.findUnique({
        where: {
            id: chatId,
            participants: {
                some: {
                    userId: userId
                }
            }
        },
        include: {
            participants: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true
                        }
                    }
                }
            },
            lastMessage: {
                select: {
                    id: true,
                    text: true,
                    createdAt: true,
                    senderId: true
                }
            }
        },
    });
}

export async function getChatMessages(userId: string, chatId: string, cursorId?: string, cursorCreatedAt?: Date) {
    return await prisma.message.findMany({
        take: 31,
        where: {
            chatId: chatId,
            chat: {
                participants: {
                    some: {
                        userId: userId
                    }
                }
            },
            ...(cursorId && cursorCreatedAt && {
                OR: [
                    {
                        createdAt: {
                            lt: cursorCreatedAt
                        }
                    },
                    {
                        createdAt: cursorCreatedAt,
                        id: {
                            lt: cursorId
                        }
                    }
                ]
            }),
        },
        orderBy: [
            {
                createdAt: 'desc'
            },
            {
                id: 'desc'
            }
        ]
    });
}

export async function assertUserIsChatParticipant(userId: string, chatId: string): Promise<void> {
    const chatParticipant = await prisma.chatParticipant.findUnique({
        where: {
            chatId_userId: {
                chatId: chatId,
                userId: userId
            },
            leftAt: null
        }
    });

    if (!chatParticipant) {
        throw new AppError(
            "Chat not found.",
            "CHAT_NOT_FOUND",
            404
        );
    }
}

export async function sendMessage(userId: string, chatId: string, text: string) {

    return await prisma.$transaction(async (tx) => {
        const message = await tx.message.create({
            data: {
                chatId,
                senderId: userId,
                text
            }
        });

        await tx.chat.update({
            where: {
                id: chatId
            },
            data: {
                lastMessageId: message.id
            }
        });

        return message;
    });

}
