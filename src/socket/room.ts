import type { Socket } from "socket.io";
import { getUsersChatIds } from "../services/chatService.js";

export async function joinUserChatRooms(socket: Socket) {
    const userId = socket.data.userId;

    const userChatIds = await getUsersChatIds(userId);

    if (socket.connected) {
        await socket.join(userChatIds.map(chatId => `chat:${chatId}`));
    }

    return userChatIds;
}
