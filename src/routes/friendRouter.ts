import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { authed } from '../middleware/authed.js';
import { handleAcceptFriendRequest, handleGetSentFriendRequests, handleGetReceivedFriendRequests, handleRejectFriendRequest, handleSendFriendRequest, handleGetAllFriends } from '../controllers/friendController.js';

export const friendRouter = Router();

friendRouter.get('/', authenticateToken, authed(handleGetAllFriends));
friendRouter.post('/requests', authenticateToken, authed(handleSendFriendRequest));
friendRouter.get('/requests/sent', authenticateToken, authed(handleGetSentFriendRequests));
friendRouter.get('/requests/received', authenticateToken, authed(handleGetReceivedFriendRequests));
friendRouter.patch('/requests/:friendRequestId/accept', authenticateToken, authed(handleAcceptFriendRequest));
friendRouter.patch('/requests/:friendRequestId/reject', authenticateToken, authed(handleRejectFriendRequest));