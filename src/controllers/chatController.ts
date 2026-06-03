import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/express.js";
import { AppError } from "../errors/AppError.js";
import { validateUsersAreFriends } from "../services/friendService.js";
import { assertUserIsChatParticipant, createDirectChat, getAllChats, getChatMessages, getSingleChat, sendMessage } from "../services/chatService.js";
import { ChatType } from "@prisma/client";
import type { ChatWithDetails } from "../types/chat.js";

type ChatParticipantDto = {
    id: string;
    username: string;
    email: string;
};

type LastMessageDto = {
    id: string;
    text: string;
    createdAt: Date;
    senderId: string;
};

type ChatDto = {
    id: string;
    chatType: ChatType;
    title: string;
    name: string | null;
    participants: ChatParticipantDto[];
    createdAt: Date;
    updatedAt: Date;
    lastMessage: LastMessageDto | null;
};

function parseMessageCursor(query: AuthenticatedRequest["query"]): {
    cursorId: string | undefined;
    cursorCreatedAt: Date | undefined;
} {
    const rawCursorId = query.cursorId;
    const rawCursorCreatedAt = query.cursorCreatedAt;

    let cursorId: string | undefined;
    let cursorCreatedAt: Date | undefined;

    if (rawCursorId === undefined) {
        cursorId = undefined;
    }
    else if (typeof rawCursorId === "string") {
        cursorId = rawCursorId;
    }
    else {
        throw new AppError(
            "Invalid cursorId. Must be a string.",
            "INVALID_CURSOR_ID",
            400
        );
    }

    if (rawCursorCreatedAt === undefined) {
        cursorCreatedAt = undefined;
    }
    else if (typeof rawCursorCreatedAt === "string") {
        cursorCreatedAt = new Date(rawCursorCreatedAt);

        if (Number.isNaN(cursorCreatedAt.getTime())) {
            throw new AppError(
                "Invalid cursorCreatedAt.",
                "INVALID_CURSOR_CREATED_AT",
                400
            );
        }
    }
    else {
        throw new AppError(
            "Invalid cursorCreatedAt. Must be a string.",
            "INVALID_CURSOR_CREATED_AT",
            400
        );
    }

    if ((cursorId && !cursorCreatedAt) || (!cursorId && cursorCreatedAt)) {
        throw new AppError(
            "Both cursorId and cursorCreatedAt must be provided together for pagination.",
            "INCOMPLETE_CURSOR",
            400
        );
    }

    return {
        cursorId,
        cursorCreatedAt
    };
}

function parseChatDto(chat: ChatWithDetails, userId: string): ChatDto {
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

export async function handleCreateDirectChat(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id
    const friendId = req.body.friendId

    if (!friendId) {
        throw new AppError("Body parameter 'friendId' is required.", "MISSING_FRIEND_ID", 400)
    }

    if (!(await validateUsersAreFriends(userId, friendId))) {
        throw new AppError("Users are not friends.", "USERS_ARE_NOT_FRIENDS", 404);
    }

    const chat = await createDirectChat(userId, friendId);
    const parsedChat = parseChatDto(chat, userId);

    res.status(201).json({
        success: true,
        data: {
            chat: parsedChat
        }
    });
}

export async function handleGetAllChats(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id
    let chatType = req.query.chatType as ChatType | undefined;

    if (chatType) {
        if (typeof chatType !== "string" ||
            !Object.values(ChatType).includes(chatType as ChatType)) {
            throw new AppError(
                "Invalid chat type filter. Must be 'DIRECT' or 'GROUP'.",
                "INVALID_CHAT_TYPE_FILTER",
                400
            );
        }
    }
    else {
        chatType = ChatType.DIRECT;
    }

    const allChats = await getAllChats(userId, chatType);

    const parsedChats = allChats.map(chat => parseChatDto(chat, userId));

    res.status(200).json({
        success: true,
        data: {
            chats: parsedChats
        }
    });
}

export async function handleGetSingleChat(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const chatId = req.params.chatId;

    if (!chatId) {
        throw new AppError(
            "Chat ID is required.",
            "CHAT_ID_REQUIRED",
            400
        );
    }

    const chat = await getSingleChat(userId, chatId);

    if (!chat) {
        throw new AppError(
            "Chat not found.",
            "CHAT_NOT_FOUND",
            404
        );
    }

    const parsedChat = parseChatDto(chat, userId);

    res.status(200).json({
        success: true,
        data: {
            chat: parsedChat
        }
    });
}

export async function handleGetMessages(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const chatId = req.params.chatId;

    if (!chatId) {
        throw new AppError(
            "Chat ID is required.",
            "CHAT_ID_REQUIRED",
            400
        );
    }

    const { cursorId, cursorCreatedAt } = parseMessageCursor(req.query);

    const messages = await getChatMessages(userId, chatId, cursorId, cursorCreatedAt);
    const hasMore = messages.length > 30;
    const pageMessages = messages.slice(0, 30);
    const lastMessage = pageMessages[pageMessages.length - 1];

    const nextCursor = hasMore && lastMessage
        ? {
            cursorId: lastMessage.id,
            cursorCreatedAt: lastMessage.createdAt.toISOString()
        }
        : null;

    res.status(200).json({
        success: true,
        data: {
            nextCursor,
            messages: pageMessages.map(message => ({
                id: message.id,
                senderId: message.senderId,
                text: message.text,
                createdAt: message.createdAt
            })).reverse(),
            hasMore
        }
    });
}

export async function handleSendMessage(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const chatId = req.params.chatId;
    let text = req.body.text;

    if (!chatId) {
        throw new AppError(
            "Chat ID is required.",
            "CHAT_ID_REQUIRED",
            400
        );
    }

    if (!text || typeof text !== "string" || text.trim() === "") {
        throw new AppError(
            "Message text is required.",
            "MESSAGE_TEXT_REQUIRED",
            400
        );
    }

    const trimmedText = text.trim();

    if (trimmedText.length > 2000) {
        throw new AppError(
            "Message text cannot exceed 2000 characters.",
            "MESSAGE_TEXT_TOO_LONG",
            400
        );
    }

    await assertUserIsChatParticipant(userId, chatId);
    const message = await sendMessage(userId, chatId, trimmedText);

    res.status(201).json({
        success: true,
        data: {
            message: {
                id: message.id,
                senderId: message.senderId,
                text: message.text,
                createdAt: message.createdAt
            }
        }
    });
}
