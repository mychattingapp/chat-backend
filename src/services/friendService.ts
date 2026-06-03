import { FriendshipStatus, type FriendRequest } from '@prisma/client';
import { Prisma } from '@prisma/client'
import { prisma } from '../config/prismaClient.js';
import { getUserByAnyEmail } from './userService.js';
import { AppError } from '../errors/AppError.js';

function makePairKey(userA: string, userB: string) {
    return [userA, userB].sort().join(":");
}

function getFriendshipPair(userA: string, userB: string) {
    const [friend1, friend2] = [userA, userB].sort() as [string, string];
    return { friend1, friend2 };
}

export async function createFriendRequest(requesterId: string, recipientId: string) {
    const pairKey = makePairKey(requesterId, recipientId);

    try {
        return await prisma.friendRequest.create({
            data: {
                requesterId,
                recipientId,
                pairKey
            },
            include: {
                recipient: true
            }
        })
    }
    catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                throw new AppError(
                    "This user has already sent you a friend request.",
                    "FRIEND_REQUEST_ALREADY_RECEIVED",
                    409
                )
            }
        }
        throw error;
    }

}

export async function getFriendRequest(requesterId: string, recipientId: string): Promise<FriendRequest | null> {
    const pairKey = makePairKey(requesterId, recipientId);

    return await prisma.friendRequest.findUnique({
        where: {
            pairKey: pairKey
        }
    })
}

export async function getFriendRequestByRequestId(friendRequestId: string) {
    return await prisma.friendRequest.findUnique({
        where: {
            id: friendRequestId
        }
    })
}

export async function assertCanSendFriendRequest(requesterId: string, recipientId: string) {
    let friendRequest = await getFriendRequest(requesterId, recipientId);

    if (friendRequest) {
        if (friendRequest.status === FriendshipStatus.ACCEPTED) {
            throw new AppError(
                "You are already friends with this user.",
                "ALREADY_FRIENDS",
                409
            )
        }
        else if (friendRequest.status === FriendshipStatus.REJECTED) {
            if (friendRequest.requesterId === requesterId)
                throw new AppError(
                    "Your previous friend request was rejected.",
                    "FRIEND_REQUEST_PREVIOUSLY_REJECTED",
                    409
                )
            throw new AppError(
                "You previously rejected a friend request from this user.",
                "FRIEND_REQUEST_PREVIOUSLY_REJECTED_BY_YOU",
                409)
        }
        else if (friendRequest.status === FriendshipStatus.PENDING) {
            if (friendRequest.requesterId === requesterId)
                throw new AppError(
                    "You have already sent a friend request to this user.",
                    "FRIEND_REQUEST_ALREADY_SENT",
                    409
                )
            throw new AppError(
                "This user has already sent you a friend request.",
                "FRIEND_REQUEST_ALREADY_RECEIVED",
                409
            )
        }
    }
}

export function assertCanAcceptFriendRequest(userId: string, friendRequest: FriendRequest) {
    if (friendRequest.recipientId !== userId) {
        throw new AppError(
            "You are not allowed to accept this friend request.",
            "FRIEND_REQUEST_NOT_FOR_YOU",
            403
        );
    }
    if (friendRequest.requesterId === userId) {
        throw new AppError(
            "You cannot accept a friend request you sent.",
            "CANNOT_ACCEPT_OWN_FRIEND_REQUEST",
            403
        );
    }

    if (friendRequest.status === FriendshipStatus.ACCEPTED) {
        throw new AppError(
            "You are already friends with this user.",
            "ALREADY_FRIENDS",
            409
        )
    }
    else if (friendRequest.status === FriendshipStatus.REJECTED) {
        throw new AppError(
            "You have already rejected a friend request from this user.",
            "FRIEND_REQUEST_PREVIOUSLY_REJECTED_BY_YOU",
            409
        )
    }
}

export function assertCanRejectFriendRequest(userId: string, friendRequest: FriendRequest) {
    if (friendRequest.recipientId !== userId) {
        throw new AppError(
            "You are not allowed to reject this friend request.",
            "FRIEND_REQUEST_NOT_FOR_YOU",
            403
        );
    }
    if (friendRequest.requesterId === userId) {
        throw new AppError(
            "You cannot reject a friend request you sent.",
            "CANNOT_REJECT_OWN_FRIEND_REQUEST",
            403
        );
    }

    if (friendRequest.status === FriendshipStatus.ACCEPTED) {
        throw new AppError(
            "You are already friends with this user.",
            "ALREADY_FRIENDS",
            409
        )
    }
    else if (friendRequest.status === FriendshipStatus.REJECTED) {
        throw new AppError(
            "You have already rejected a friend request from this user.",
            "FRIEND_REQUEST_PREVIOUSLY_REJECTED_BY_YOU",
            409
        )
    }
}

export async function sendFriendRequest(requesterId: string, recipientEmail: string) {
    const recipient = await getUserByAnyEmail(recipientEmail);

    if (!recipient) {
        throw new AppError("User not found", "USER_NOT_FOUND", 404);
    }
    if (recipient.id === requesterId) {
        throw new AppError(
            "You cannot send a friend request to yourself.",
            "CANNOT_REQUEST_SELF",
            400);
    }

    await assertCanSendFriendRequest(requesterId, recipient.id);
    const createdFriendRequest = await createFriendRequest(requesterId, recipient.id);

    return createdFriendRequest;
}

export async function acceptFriendRequest(userId: string, friendRequestId: string) {

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const friendRequest = await tx.friendRequest.findUnique({
            where: {
                id: friendRequestId
            }
        });
        if (!friendRequest) {
            throw new AppError(
                "No friend request found from this user.",
                "FRIEND_REQUEST_NOT_FOUND",
                404
            )
        }
        assertCanAcceptFriendRequest(userId, friendRequest);

        const updatedRequestArray = await tx.friendRequest.updateManyAndReturn({
            where: {
                id: friendRequestId,
                recipientId: userId,
                status: FriendshipStatus.PENDING,
            },
            data: {
                status: FriendshipStatus.ACCEPTED
            },
            include: {
                requester: true
            }
        })

        const [updatedRequest] = updatedRequestArray;
        if (!updatedRequest) {
            throw new AppError(
                "No pending friend request found to accept.",
                "FRIEND_REQUEST_NOT_FOUND_OR_ALREADY_PROCESSED",
                409
            )
        }

        const { friend1, friend2 } = getFriendshipPair(friendRequest.requesterId, friendRequest.recipientId);

        await tx.friendship.upsert({
            where: {
                friend1_friend2: {
                    friend1,
                    friend2
                }
            },
            update: {},
            create: {
                friend1,
                friend2
            },
        });
        return updatedRequest;
    })
}

export async function rejectFriendRequest(userId: string, friendRequestId: string) {
    const friendRequest = await getFriendRequestByRequestId(friendRequestId);
    if (!friendRequest) {
        throw new AppError(
            "No friend request found from this user.",
            "FRIEND_REQUEST_NOT_FOUND",
            404
        )
    }
    assertCanRejectFriendRequest(userId, friendRequest);

    const updatedRequestArray = await prisma.friendRequest.updateManyAndReturn({
        where: {
            id: friendRequestId,
            recipientId: userId,
            status: FriendshipStatus.PENDING
        },
        data: {
            status: FriendshipStatus.REJECTED
        },
        include: {
            requester: true
        }
    })

    const [updatedRequest] = updatedRequestArray;
    if (!updatedRequest) {
        throw new AppError(
            "No pending friend request found to reject.",
            "FRIEND_REQUEST_NOT_FOUND_OR_ALREADY_PROCESSED",
            409
        )
    }

    return updatedRequest;
}

export async function getSentFriendRequests(userId: string, status: FriendshipStatus) {
    return await prisma.friendRequest.findMany({
        where: {
            requesterId: userId,
            status: status,
        },
        include: {
            recipient: true
        }
    });
}

export async function getReceivedFriendRequests(userId: string, status: FriendshipStatus) {
    return await prisma.friendRequest.findMany({
        where: {
            recipientId: userId,
            status: status,
        },
        include: {
            requester: true
        }
    });
}

export async function getAllFriends(userId: string) {
    return await prisma.friendship.findMany({
        where: {
            OR: [
                { friend1: userId },
                { friend2: userId }
            ]
        },
        select: {
            id: true,
            friend1Relation: {
                select: {
                    id: true,
                    username: true,
                    email: true
                },
            },
            friend2Relation: {
                select: {
                    id: true,
                    username: true,
                    email: true
                },
            }
        },
        orderBy:{
            createdAt: 'desc'
        }
    });
}

export async function validateUsersAreFriends(user1Id: string, user2Id: string) {
    const {friend1, friend2} = getFriendshipPair(user1Id, user2Id);

    const friendship = await prisma.friendship.findUnique({
        where: {
            friend1_friend2: {
                friend1: friend1,
                friend2: friend2
            }
        }
    });

    return !!friendship;
}