import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/express.js";
import { acceptFriendRequest, getReceivedFriendRequests, getSentFriendRequests, rejectFriendRequest, sendFriendRequest, getAllFriends } from "../services/friendService.js";
import { AppError } from "../errors/AppError.js";
import { FriendshipStatus } from "@prisma/client";

function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function parseFriendRequestStatus(status: unknown): FriendshipStatus {
    if (!status) {
        return FriendshipStatus.PENDING;
    }

    if (status === FriendshipStatus.PENDING || status === FriendshipStatus.REJECTED) {
        return status;
    }

    throw new AppError(
        "Invalid friend request status.",
        "INVALID_FRIEND_REQUEST_STATUS",
        400
    );
}

export async function handleSendFriendRequest(req: AuthenticatedRequest, res: Response) {
    const recipientEmail = req.body.recipientEmail
    const userId = req.user.id

    if (!validateEmail(recipientEmail)) {
        throw new AppError("Invalid email format", "INVALID_EMAIL_FORMAT", 400)
    }

    if (!recipientEmail) {
        throw new AppError("email no sent", "yurr", 400)
    }

    const createdFriendRequest = await sendFriendRequest(userId, recipientEmail)

    return res.status(201).json({
        success: true,
        friendRequest: {
            id: createdFriendRequest.id,
            status: createdFriendRequest.status,
            createdAt: createdFriendRequest.createdAt,
            recipient: {
                id: createdFriendRequest.recipient.id,
                username: createdFriendRequest.recipient.username,
                email: createdFriendRequest.recipient.email
            }
        }
    })
}

export async function handleAcceptFriendRequest(req: AuthenticatedRequest, res: Response) {
    const friendRequestId = req.params.friendRequestId
    const userId = req.user.id

    if (!friendRequestId) {
        throw new AppError(
            "Friend request ID is required.",
            "FRIEND_REQUEST_ID_REQUIRED",
            400
        );
    }

    const updatedFriendRequest = await acceptFriendRequest(userId, friendRequestId)

    return res.status(200).json({
        success: true,
        friendRequest: {
            id: updatedFriendRequest.id,
            status: updatedFriendRequest.status,
            updatedAt: updatedFriendRequest.updatedAt,
            requester: {
                id: updatedFriendRequest.requester.id,
                username: updatedFriendRequest.requester.username,
                email: updatedFriendRequest.requester.email
            }
        }
    })
}

export async function handleRejectFriendRequest(req: AuthenticatedRequest, res: Response) {
    const friendRequestId = req.params.friendRequestId
    const userId = req.user.id

    if (!friendRequestId) {
        throw new AppError(
            "Friend request ID is required.",
            "FRIEND_REQUEST_ID_REQUIRED",
            400
        );
    }

    const updatedFriendRequest = await rejectFriendRequest(userId, friendRequestId)

    return res.status(200).json({
        success: true,
        friendRequest: {
            id: updatedFriendRequest.id,
            status: updatedFriendRequest.status,
            updatedAt: updatedFriendRequest.updatedAt,
            requester: {
                id: updatedFriendRequest.requester.id,
                username: updatedFriendRequest.requester.username,
                email: updatedFriendRequest.requester.email
            }
        }
    })
}

export async function handleGetSentFriendRequests(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const status = parseFriendRequestStatus(req.query.status);

    const sentFriendRequests = await getSentFriendRequests(userId, status);

    res.status(200).json({
        success: true,
        FriendRequests: sentFriendRequests.map(friendRequest => ({
            id: friendRequest.id,
            status: friendRequest.status,
            createdAt: friendRequest.createdAt,
            recipient: {
                id: friendRequest.recipient.id,
                username: friendRequest.recipient.username,
                email: friendRequest.recipient.email
            }
        }))
    });
}

export async function handleGetReceivedFriendRequests(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const status = parseFriendRequestStatus(req.query.status);

    const receivedFriendRequests = await getReceivedFriendRequests(userId, status);

    res.status(200).json({
        success: true,
        FriendRequests: receivedFriendRequests.map(friendRequest => ({
            id: friendRequest.id,
            status: friendRequest.status,
            createdAt: friendRequest.createdAt,
            requester: {
                id: friendRequest.requester.id,
                username: friendRequest.requester.username,
                email: friendRequest.requester.email
            }
        }))
    });
}

export async function handleGetAllFriends(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;

    const allFriends = await getAllFriends(userId);

    res.status(200).json({
        success: true,
        Friends: allFriends.map(friend => (
            friend.friend1Relation.id === userId ?
                {
                    friendshipId: friend.id,
                    id: friend.friend2Relation.id,
                    username: friend.friend2Relation.username,
                    email: friend.friend2Relation.email
                } : {
                    friendshipId: friend.id,
                    id: friend.friend1Relation.id,
                    username: friend.friend1Relation.username,
                    email: friend.friend1Relation.email
                }
        ))
    });
}
