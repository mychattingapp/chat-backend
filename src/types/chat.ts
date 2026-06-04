import type { Chat } from "@prisma/client";

export type ChatParticipantUser = {
    id: string;
    username: string;
    email: string;
};

export type ChatLastMessage = {
    id: string;
    text: string;
    createdAt: Date;
    senderId: string;
};

export type ChatWithDetails = Chat & {
    participants: {
        user: ChatParticipantUser;
    }[];
    lastMessage: ChatLastMessage | null;
};
