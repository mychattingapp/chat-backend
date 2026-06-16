import type { Socket } from "socket.io";
import { assertUserIsChatParticipant } from "../../services/chatService.js";
import { AppError } from "../../errors/AppError.js";

type TypingPayload = {
    chatId?: unknown;
};

function emitTypingUpdate(socket: Socket, chatId: string, isTyping: boolean) {
    socket.to(`chat:${chatId}`).emit("typing:update", {
        chatId,
        userId: socket.data.userId,
        isTyping,
    });
}

async function handleTypingUpdate(socket: Socket, payload: unknown, isTyping: boolean) {
    const userId = socket.data.userId;

    if (typeof payload !== "object" || payload === null) {
        socket.emit("chat:error", {
            code: "INVALID_PAYLOAD",
            message: "Invalid payload",
        });
        return;
    }

    const { chatId } = payload as TypingPayload;

    if (!userId || !chatId || typeof userId !== "string" || typeof chatId !== "string" || userId.trim() === "") {
        socket.emit("chat:error", {
            code: "INVALID_PAYLOAD",
            message: "Invalid payload",
        });
        return;
    }

    try {
        await assertUserIsChatParticipant(userId, chatId);
        emitTypingUpdate(socket, chatId, isTyping);
    }
    catch (error) {
        socket.emit("chat:error", {
            code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
            message: error instanceof AppError ? error.message : "An internal error occurred",
        });
    }
}

export function registerTypingHandlers(socket: Socket) {
    socket.on("typing:start", (payload) => {
        void handleTypingUpdate(socket, payload, true);
    });

    socket.on("typing:stop", (payload) => {
        void handleTypingUpdate(socket, payload, false);
    });
}
