import type { Socket } from "socket.io";
import { sendMessage } from "../../services/chatService.js";
import { AppError } from "../../errors/AppError.js";
import { io } from "../index.js";
import { parseMessageDto, parseSendMessageInput, type MessageDto } from "../../dtos/chatDto.js";

export function emitNewMessage(chatId: string, message: MessageDto, senderSocket?: Socket) {
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

    const { chatId } = payload as { chatId?: unknown };

    if (!chatId || typeof chatId !== 'string') {
        return ack({
            success: false,
            error: {
                code: "INVALID_PAYLOAD",
                message: "Invalid payload"
            }
        });
    }

    try {
        const messageInput = parseSendMessageInput(payload);
        const message = await sendMessage(userId, chatId, messageInput);
        const messagePayload = parseMessageDto(message);
        
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
