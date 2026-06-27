import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/express.js";
import { AppError } from "../errors/AppError.js";
import { validateUsersAreFriends } from "../services/friendService.js";
import { createDirectChat, getAllChats, getChatMessages, getMessageImageReadUrl, getSingleChat, sendMessage } from "../services/chatService.js";
import { ChatType } from "@prisma/client";
import { parseChatDto, parseMessageDto, parseSendMessageInput } from "../dtos/chatDto.js";
import { emitNewChat } from "../socket/handlers/chatHandler.js";
import { emitNewMessage } from "../socket/handlers/messageHandler.js";

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

export async function handleCreateDirectChat(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id
    const friendId = req.body.friendId

    if (!friendId) {
        throw new AppError(
            "Body parameter 'friendId' is required.",
            "MISSING_FRIEND_ID",
            400
        )
    }

    if (!(await validateUsersAreFriends(userId, friendId))) {
        throw new AppError(
            "Users are not friends.",
            "USERS_ARE_NOT_FRIENDS",
            404
        );
    }

    const { chat, wasCreated } = await createDirectChat(userId, friendId);
    const parsedChat = parseChatDto(chat, userId);

    if (wasCreated) {
        emitNewChat(chat.participants.map(participant => participant.user), chat.id);
    }

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
            messages: pageMessages.map(parseMessageDto).reverse(),
            hasMore
        }
    });
}

export async function handleSendMessage(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const chatId = req.params.chatId;

    if (!chatId) {
        throw new AppError(
            "Chat ID is required.",
            "CHAT_ID_REQUIRED",
            400
        );
    }

    const messageInput = parseSendMessageInput(req.body);
    const message = await sendMessage(userId, chatId, messageInput);
    const messagePayload = parseMessageDto(message);

    emitNewMessage(chatId, messagePayload);

    res.status(201).json({
        success: true,
        data: {
            message: messagePayload
        }
    });
}

export async function handleGetMessageImageUrl(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const chatId = req.params.chatId;
    const messageId = req.params.messageId;

    if (!chatId) {
        throw new AppError(
            "Chat ID is required.",
            "CHAT_ID_REQUIRED",
            400
        );
    }

    if (!messageId) {
        throw new AppError(
            "Message ID is required.",
            "MESSAGE_ID_REQUIRED",
            400
        );
    }

    const imageUrl = await getMessageImageReadUrl(userId, chatId, messageId);

    res.status(200).json({
        success: true,
        data: {
            imageUrl
        }
    });
}
