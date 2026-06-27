import type { Chat } from "@prisma/client";

export type ChatParticipantUser = {
    id: string;
    username: string;
    email: string;
    profileImageUrl: string | null;
    updatedAt: Date;
};

export type ChatLastMessage = {
    id: string;
    text: string | null;
    imageKey: string | null;
    imageContentType: string | null;
    createdAt: Date;
    senderId: string;
};

export type ChatWithDetails = Chat & {
    participants: {
        user: ChatParticipantUser;
        userId: string;
        lastReadMessageId: string | null;
    }[];
    lastMessage: ChatLastMessage | null;
    unreadCount?: number;
    lastReadMessageId?: string | null;
};
