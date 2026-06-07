import { ChatType } from "@prisma/client";
import { AppError } from "../errors/AppError.js";
import type { ChatWithDetails } from "../types/chat.js";

export type ChatParticipantDto = {
    id: string;
    username: string;
    email: string;
};

export type LastMessageDto = {
    id: string;
    text: string;
    createdAt: Date;
    senderId: string;
};

export type ChatDto = {
    id: string;
    chatType: ChatType;
    title: string;
    name: string | null;
    participants: ChatParticipantDto[];
    createdAt: Date;
    updatedAt: Date;
    lastMessage: LastMessageDto | null;
};

export function parseChatDto(chat: ChatWithDetails, userId: string): ChatDto {
    const participants = chat.participants
        .map(participant => ({
            id: participant.user.id,
            username: participant.user.username,
            email: participant.user.email
        }))
        .filter(participant => chat.chatType === ChatType.GROUP
            || participant.id !== userId);

    let title: string;

    if (chat.chatType === ChatType.DIRECT) {
        const friendParticipant = participants[0];

        if (!friendParticipant) {
            throw new AppError(
                "Direct chat participant not found.",
                "DIRECT_CHAT_PARTICIPANT_NOT_FOUND",
                500
            );
        }

        title = friendParticipant.username;
    }
    else {
        title = chat.name ?? "Group Chat";
    }

    return {
        id: chat.id,
        chatType: chat.chatType,
        title,
        name: chat.name,
        participants,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        lastMessage: chat.lastMessage ? {
            id: chat.lastMessage.id,
            text: chat.lastMessage.text,
            createdAt: chat.lastMessage.createdAt,
            senderId: chat.lastMessage.senderId
        } : null
    };
}
