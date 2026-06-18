import { ChatType, Prisma } from "@prisma/client";
import { prisma } from "../config/prismaClient.js";
import { AppError } from "../errors/AppError.js";
import type { ChatWithDetails } from "../types/chat.js";

function makeDirectKey(user1Id: string, user2Id: string): string {
    const [friend1, friend2] = [user1Id, user2Id].sort() as [string, string];
    return `${friend1}:${friend2}`;
}

const chatWithDetailsInclude = {
    participants: {
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                    profileImageUrl: true,
                    updatedAt: true
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
} satisfies Prisma.ChatInclude;

type UnreadCountRow = {
    chatId: string;
    unreadCount: number | bigint;
};

async function getUnreadCountsByChatId(userId: string): Promise<Map<string, number>> {
    const unreadCounts = await prisma.$queryRaw<UnreadCountRow[]>`
        SELECT cp."chatId", COUNT(m.id)::int AS "unreadCount"
        FROM "ChatParticipant" cp
        JOIN "Message" m
            ON m."chatId" = cp."chatId"
        LEFT JOIN "Message" lm
            ON lm.id = cp."lastReadMessageId"
        WHERE cp."userId" = ${userId}
            AND cp."leftAt" IS NULL
            AND m."senderId" <> ${userId}
            AND m."createdAt" >= cp."joinedAt"
            AND (
                cp."lastReadMessageId" IS NULL
                OR m."createdAt" > lm."createdAt"
                OR (
                    m."createdAt" = lm."createdAt"
                    AND m.id > lm.id
                )
            )
        GROUP BY cp."chatId"
    `;

    return new Map(unreadCounts.map((row) => [
        row.chatId,
        Number(row.unreadCount)
    ]));
}

function attachChatReadState<T extends ChatWithDetails>(
    chat: T,
    userId: string,
    unreadCountsByChatId: Map<string, number>
): T {
    const currentUserParticipant = chat.participants.find((participant) => participant.userId === userId);

    return {
        ...chat,
        unreadCount: unreadCountsByChatId.get(chat.id) ?? 0,
        lastReadMessageId: currentUserParticipant?.lastReadMessageId ?? null
    };
}

export async function createDirectChat(user1Id: string, user2Id: string): Promise<{ chat: ChatWithDetails; wasCreated: boolean }> {
    const directKey = makeDirectKey(user1Id, user2Id);

    try {
        const chat = await prisma.chat.create({
            data: {
                chatType: ChatType.DIRECT,
                directKey,
                participants: {
                    create: [
                        { userId: user1Id },
                        { userId: user2Id }
                    ]
                }
            },
            include: chatWithDetailsInclude
        });

        return {
            chat,
            wasCreated: true
        };
    }
    catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
            throw error;
        }

        const chat = await prisma.chat.findUnique({
            where: {
                directKey
            },
            include: chatWithDetailsInclude
        });

        if (!chat) {
            throw error;
        }

        return {
            chat,
            wasCreated: false
        };
    }
}

export async function getAllChats(userId: string, chatType: ChatType): Promise<ChatWithDetails[]> {
    const [chats, unreadCountsByChatId] = await Promise.all([
        prisma.chat.findMany({
            where: {
                participants: {
                    some: {
                        userId: userId
                    }
                },
                chatType: chatType
            },
            include: chatWithDetailsInclude,
            orderBy: {
                updatedAt: 'desc'
            }
        }),
        getUnreadCountsByChatId(userId)
    ]);

    return chats.map((chat) => attachChatReadState(chat, userId, unreadCountsByChatId));
}

export async function getSingleChat(userId: string, chatId: string): Promise<ChatWithDetails | null> {
    const [chat, unreadCountsByChatId] = await Promise.all([
        prisma.chat.findUnique({
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
                                email: true,
                                profileImageUrl: true,
                                updatedAt: true
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
        }),
        getUnreadCountsByChatId(userId)
    ]);

    return chat
        ? attachChatReadState(chat, userId, unreadCountsByChatId)
        : null;
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

export async function getUsersChatIds(userId: string): Promise<string[]> {
    const chats = await prisma.chat.findMany({
        where: {
            participants: {
                some: {
                    userId: userId
                }
            }
        },
        select: {
            id: true
        }
    })

    return chats.map(chat => chat.id)
}

export async function getUsersChatParticipantIds(userId: string): Promise<string[]> {
    const chatParticipants = await prisma.chatParticipant.findMany({
        where: {
            leftAt: null,
            chat: {
                participants: {
                    some: {
                        userId: userId,
                        leftAt: null
                    }
                }
            }
        },
        select: {
            userId: true
        },
        distinct: ['userId']
    });

    return chatParticipants.map((participant) => participant.userId);
}

export async function markChatRead(userId: string, chatId: string, messageId: string) {

    await prisma.$transaction(async tx => {

        const chatParticipant = await tx.chatParticipant.findUnique({
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

        const latestMessageRead = await tx.message.findFirst({
            where: {
                id: messageId,
                chatId: chatId
            }
        })

        if (!latestMessageRead) {
            throw new AppError(
                "Message not found.",
                "MESSAGE_NOT_FOUND",
                404
            );
        }

        let currentLastReadMessageId = chatParticipant.lastReadMessageId;
        const maxUpdateAttempts = 3;

        for (let attempt = 0; attempt < maxUpdateAttempts; attempt += 1) {
            if (currentLastReadMessageId) {
                const currentLastReadMessage = await tx.message.findFirst({
                    where: {
                        id: currentLastReadMessageId
                    }
                })

                if (!currentLastReadMessage) return

                const currentLastReadMessageIsAhead =
                    currentLastReadMessage.createdAt > latestMessageRead.createdAt ||
                    (
                        currentLastReadMessage.createdAt.getTime() === latestMessageRead.createdAt.getTime() &&
                        currentLastReadMessage.id >= latestMessageRead.id
                    );

                if (currentLastReadMessageIsAhead) {
                    return
                }
            }

            const updateResult = await tx.chatParticipant.updateMany({
                where: {
                    chatId: chatId,
                    userId: userId,
                    lastReadMessageId: currentLastReadMessageId
                },
                data: {
                    lastReadMessageId: messageId,
                    lastReadAt: new Date()
                }
            })

            if (updateResult.count > 0) {
                return
            }

            const refreshedChatParticipant = await tx.chatParticipant.findUnique({
                where: {
                    chatId_userId: {
                        chatId: chatId,
                        userId: userId
                    },
                    leftAt: null
                }
            });

            if (!refreshedChatParticipant) {
                throw new AppError(
                    "Chat not found.",
                    "CHAT_NOT_FOUND",
                    404
                );
            }

            currentLastReadMessageId = refreshedChatParticipant.lastReadMessageId;
        }

        throw new AppError(
            "Read marker update conflicted. Please retry.",
            "READ_MARKER_UPDATE_CONFLICT",
            409
        );
    })
    return;
}
