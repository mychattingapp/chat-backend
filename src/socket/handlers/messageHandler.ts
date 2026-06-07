import type { Socket } from "socket.io";
import { assertUserIsChatParticipant, sendMessage } from "../../services/chatService.js";
import { AppError } from "../../errors/AppError.js";
import { io } from "../index.js";

type NewMessagePayload = {
    id: string;
    senderId: string;
    text: string;
    createdAt: Date;
};

export function emitNewMessage(chatId: string, message: NewMessagePayload, senderSocket?: Socket) {
    const payload = {
        chatId,
        message
    };

    if (senderSocket) {
        senderSocket.to(`chat:${chatId}`).emit('message:new', payload);
        return;
    }

    io.to(`chat:${chatId}`).emit('message:new', payload);
}

async function handleSendingMessage(socket: Socket, payload: unknown, ack: (response: any) => void) {
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

    const { chatId, text } = payload as { chatId?: unknown; text?: unknown };

    if (!text || !chatId || typeof chatId !== 'string' || typeof text !== 'string' || text.trim() === '') {
        return ack({
            success: false,
            error: {
                code: "INVALID_PAYLOAD",
                message: "Invalid payload"
            }
        });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 2000) {
        return ack({
            success: false,
            error: {
                code: "MESSAGE_TEXT_TOO_LONG",
                message: "Message text cannot exceed 2000 characters."
            }
        });
    }

    try {
        await assertUserIsChatParticipant(userId, chatId);
        const message = await sendMessage(userId, chatId, trimmedText);

        const messagePayload = {
            id: message.id,
            senderId: message.senderId,
            text: message.text,
            createdAt: message.createdAt
        };
        
        emitNewMessage(chatId, messagePayload, socket);
        return ack({
            success: true,
            data: {
                message: messagePayload
            }
        });
    }
    catch (error) {
        return ack({
            success: false,
            error: {
                code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
                message: error instanceof AppError ? error.message : "An error occurred while sending the message."
            }
        });
    }
}

export async function registerMessageHandlers(socket: Socket) {
    socket.on('message:send', (payload, ack) => {
        if (typeof ack !== 'function') {
            socket.emit('message:error', {
                code: "ACK_REQUIRED",
                message: "Acknowledgement callback is required."
            });
            return;
        }

        void handleSendingMessage(socket, payload, ack);
    });
}
