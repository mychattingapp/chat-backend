import type { Socket } from "socket.io";
import { getUsersChatIds } from "../services/chatService.js";

export async function joinUserChatRooms(socket: Socket) {
    const userId = socket.data.userId;

    const userChatIds = await getUsersChatIds(userId);

    userChatIds.forEach(chatId => {
        socket.join(`chat:${chatId}`);
    });

    return userChatIds;
}
