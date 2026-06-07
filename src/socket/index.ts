import { Server } from "socket.io";
import { requireEnv } from '../config/env.js';
import http from 'http';
import { handleConnection } from "./connection.js";
import { authenticateSocket } from "./middleware.js";

export let io: Server;

export function initialiseSocket(httpServer: ReturnType<typeof http.createServer>) {
    io = new Server(httpServer, {
        cors: {
            origin: requireEnv('CLIENT_URL'),
            credentials: true
        }
    });

    io.use(authenticateSocket);
    io.on('connection', socket => handleConnection(socket));
}
