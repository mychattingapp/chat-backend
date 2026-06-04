import { Router } from "express";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { authed } from "../middleware/authed.js";
import { handleCreateDirectChat, handleGetAllChats, handleGetMessages, handleGetSingleChat, handleSendMessage } from "../controllers/chatController.js";

export const chatRouter = Router();

chatRouter.post('/', authenticateToken, authed(handleCreateDirectChat));
chatRouter.get('/', authenticateToken, authed(handleGetAllChats));
chatRouter.get('/:chatId/messages', authenticateToken, authed(handleGetMessages));
chatRouter.post('/:chatId/messages', authenticateToken, authed(handleSendMessage));
chatRouter.get('/:chatId', authenticateToken, authed(handleGetSingleChat)); 
