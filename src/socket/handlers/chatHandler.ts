import type { Socket } from "socket.io";
import { io } from "../index.js";
import { assertUserIsChatParticipant, getSingleChat, markChatRead } from "../../services/chatService.js";
import { parseChatDto } from "../../dtos/chatDto.js";
import { AppError } from "../../errors/AppError.js";
import type { ChatParticipantUser } from "../../types/chat.js";
import { isUserOnline, trackPresenceChatForSocket } from "./presenceHandler.js";

function joinConnectedUserSocketsToChat(userId: string, chatId: string) {
    const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);

    for (const socketId of userRoom ?? []) {
        io.sockets.sockets.get(socketId)?.join(`chat:${chatId}`);
    }
}

export function emitNewChat(participantsList: ChatParticipantUser[], chatId: string) {
    for (const user of participantsList) {
        joinConnectedUserSocketsToChat(user.id, chatId);

        io.to(`user:${user.id}`).emit('chat:new', {
            chatId: chatId
        });
    }
}

async function handleJoiningChat(socket: Socket, payload: unknown, ack: (response: any) => void) {
    const userId = socket.data.userId;
    if (typeof payload !== 'object' || payload === null) {
        return ack({
            success: false,
            error: {
                code: "INVALID_PAYLOAD",
                message: "Invalid payload"
            }
        });
    }

    const { chatId } = payload as { chatId?: unknown };

    if (!userId || !chatId || typeof chatId !== 'string' || typeof userId !== 'string' || userId.trim() === '') {
        return ack({
            success: false,
            error: {
                code: "INVALID_PAYLOAD",
                message: "Invalid payload"
            }
        });
    }

    try {
        await assertUserIsChatParticipant(userId, chatId);
        const chat = await getSingleChat(userId, chatId);

        if (!chat) {
            return ack({
                success: false,
                error: {
                    code: "CHAT_NOT_FOUND",
                    message: "Chat not found"
                }
            });
        }

        const parsedChat = parseChatDto(chat, userId);
        const onlineUserIds = parsedChat.participants
            .filter((participant) => participant.id !== userId && isUserOnline(participant.id))
            .map((participant) => participant.id);

        socket.join(`chat:${chatId}`);
        trackPresenceChatForSocket(socket, chatId);
        return ack({
            success: true,
            data: {
                chat: parsedChat,
                onlineUserIds
            }
        });
    }
    catch (error) {
        return ack({
            success: false,
            error: {
                code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
                message: error instanceof AppError ? error.message : "An internal error occurred"
            }
        });
    }
}

async function handleReadingMessage(socket: Socket, payload: unknown, ack: (response: any) => void) {
    const userId = socket.data.userId;
    if (typeof payload !== 'object' || payload === null) {
        return ack({
            success: false,
            error: {
                code: "INVALID_PAYLOAD",
                message: "Invalid payload"
            }
        });
    }

    const { chatId, lastReadMessageId } = payload as { chatId?: unknown, lastReadMessageId?: unknown };

    if (!userId || !chatId || !lastReadMessageId || typeof chatId !== 'string' || typeof userId !== 'string' || typeof lastReadMessageId !== 'string' || userId.trim() === '') {
        return ack({
            success: false,
            error: {
                code: "INVALID_PAYLOAD",
                message: "Invalid payload"
            }
        });
    }

    try {
        await markChatRead(userId, chatId, lastReadMessageId)

        return ack({
            success: true,
        });
    }
    catch (error) {
        return ack({
            success: false,
            error: {
                code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
                message: error instanceof AppError ? error.message : "An internal error occurred"
            }
        });
    }

}
export async function registerChatHandlers(socket: Socket) {
    socket.on('chat:join', (payload, ack) => {
        if (typeof ack !== 'function') {
            socket.emit('chat:error', {
                code: "ACK_REQUIRED",
                message: "Acknowledgement callback is required."
            });
            return;
        }

        void handleJoiningChat(socket, payload, ack);
    });

    socket.on('chat:read', (payload, ack) => {
        if (typeof ack !== 'function') {
            socket.emit('chat:error', {
                code: "ACK_REQUIRED",
                message: "Acknowledgement callback is required."
            });
            return;
        }

        void handleReadingMessage(socket, payload, ack)
    })
}
