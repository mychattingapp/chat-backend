import type { Socket } from "socket.io";
import { joinUserChatRooms } from "./room.js";
import { registerMessageHandlers } from "./handlers/messageHandler.js";
import { registerChatHandlers } from "./handlers/chatHandler.js";

export async function handleConnection(socket: Socket) {
    socket.join(`user:${socket.data.userId}`);
    registerMessageHandlers(socket);
    registerChatHandlers(socket);
    
    await joinUserChatRooms(socket);
}
