import type { Socket } from "socket.io";
import { getUsersChatParticipantIds } from "../../services/chatService.js";

const socketIdsByUserId = new Map<string, Set<string>>();
const chatIdsBySocketId = new Map<string, string[]>();

export const isUserOnline = (userId: string) => {
    const socketIds = socketIdsByUserId.get(userId);
    return !!socketIds && socketIds.size > 0;
};

export function trackPresenceChatForSocket(socket: Socket, chatId: string) {
    const chatIds = chatIdsBySocketId.get(socket.id) ?? [];

    if (chatIds.includes(chatId)) {
        return;
    }

    chatIdsBySocketId.set(socket.id, [...chatIds, chatId]);
}

function getChatRooms(chatIds: string[]) {
    return chatIds.map((chatId) => `chat:${chatId}`);
}

function emitPresenceUpdate(socket: Socket, chatIds: string[], isOnline: boolean) {
    const userId = socket.data.userId;
    const chatRooms = getChatRooms(chatIds);

    if (chatRooms.length === 0) {
        return;
    }

    socket.to(chatRooms).emit("presence:update", {
        userId,
        isOnline,
    });
}

export async function handlePresenceConnected(socket: Socket, chatIds: string[]) {
    const userId = socket.data.userId;
    let socketIds = socketIdsByUserId.get(userId);
    const wasOffline = !socketIds || socketIds.size === 0;

    if (!socket.connected) {
        return;
    }

    if (!socketIds) {
        socketIds = new Set<string>();
        socketIdsByUserId.set(userId, socketIds);
    }

    socketIds.add(socket.id);
    chatIdsBySocketId.set(socket.id, chatIds);

    const participantIds = await getUsersChatParticipantIds(userId);

    if (!socketIdsByUserId.get(userId)?.has(socket.id)) {
        return;
    }

    const onlineUserIds = participantIds.filter(isUserOnline);

    socket.emit("presence:snapshot", {
        onlineUserIds,
    });

    if (wasOffline) {
        emitPresenceUpdate(socket, chatIds, true);
    }
}

function handlePresenceDisconnected(socket: Socket) {
    const userId = socket.data.userId;
    const socketIds = socketIdsByUserId.get(userId);
    const chatIds = chatIdsBySocketId.get(socket.id) ?? [];

    chatIdsBySocketId.delete(socket.id);

    if (!socketIds) {
        return;
    }

    socketIds.delete(socket.id);

    if (socketIds.size > 0) {
        return;
    }

    socketIdsByUserId.delete(userId);
    emitPresenceUpdate(socket, chatIds, false);
}

export function registerPresenceHandlers(socket: Socket) {
    socket.on("disconnecting", () => {
        handlePresenceDisconnected(socket);
    });
}
