import type { Socket } from "socket.io";
import { parse } from 'cookie';
import { verifyAccessToken } from "../utils/verifyAccessToken.js";

export function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
    try {
        const cookies = parse(socket.handshake.headers.cookie || '')
        const token = cookies['access_token'];
        if (!token) {
            return next(new Error("No token provided"));
        }

        const userId = verifyAccessToken(token);
        socket.data.userId = userId;
        return next();
    }
    catch (err) {
        return next(new Error("Authentication error"));
    }
}