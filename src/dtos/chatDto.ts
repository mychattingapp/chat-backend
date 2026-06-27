import { ChatType } from "@prisma/client";
import { AppError } from "../errors/AppError.js";
import type { ChatWithDetails } from "../types/chat.js";

export type ChatParticipantDto = {
    id: string;
    username: string;
    email: string;
    profileImageUrl: string | null;
    updatedAt: Date;
};

export type LastMessageDto = {
    id: string;
    text: string | null;
    hasImage: boolean;
    imageContentType: string | null;
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
    unreadCount: number;
    lastReadMessageId: string | null;
};

export type MessageDto = {
    id: string;
    senderId: string;
    text: string | null;
    hasImage: boolean;
    imageContentType: string | null;
    createdAt: Date;
};

export type SendMessageInputDto = {
    text: string | null;
    imageKey: string | null;
};

type MessageLike = {
    id: string;
    senderId: string;
    text: string | null;
    imageKey?: string | null;
    imageContentType?: string | null;
    createdAt: Date;
};

export function parseMessageDto(message: MessageLike): MessageDto {
    return {
        id: message.id,
        senderId: message.senderId,
        text: message.text,
        hasImage: !!message.imageKey,
        imageContentType: message.imageContentType ?? null,
        createdAt: message.createdAt
    };
}

export function parseSendMessageInput(input: unknown): SendMessageInputDto {
    if (typeof input !== "object" || input === null) {
        throw new AppError(
            "Invalid payload.",
            "INVALID_PAYLOAD",
            400
        );
    }

    const { text, imageKey } = input as { text?: unknown; imageKey?: unknown };

    if (text !== undefined && text !== null && typeof text !== "string") {
        throw new AppError(
            "Message text must be a string.",
            "INVALID_MESSAGE_TEXT",
            400
        );
    }

    if (imageKey !== undefined && imageKey !== null && (typeof imageKey !== "string" || imageKey.trim() === "")) {
        throw new AppError(
            "Image key must be a string.",
            "INVALID_IMAGE_KEY",
            400
        );
    }

    const trimmedText = typeof text === "string" ? text.trim() : "";

    if (trimmedText.length > 2000) {
        throw new AppError(
            "Message text cannot exceed 2000 characters.",
            "MESSAGE_TEXT_TOO_LONG",
            400
        );
    }

    const trimmedImageKey = typeof imageKey === "string" ? imageKey.trim() : "";

    return {
        text: trimmedText || null,
        imageKey: trimmedImageKey || null
    };
}

export function parseChatDto(chat: ChatWithDetails, userId: string): ChatDto {
    const participants = chat.participants
        .map(participant => ({
            id: participant.user.id,
            username: participant.user.username,
            email: participant.user.email,
            profileImageUrl: participant.user.profileImageUrl,
            updatedAt: participant.user.updatedAt
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
        lastMessage: chat.lastMessage ? parseMessageDto(chat.lastMessage) : null,
        unreadCount: chat.unreadCount ?? 0,
        lastReadMessageId: chat.lastReadMessageId ?? null
    };
}
