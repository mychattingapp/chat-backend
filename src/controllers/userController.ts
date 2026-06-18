import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/express.js";
import { findUser, updateUserProfile } from "../services/userService.js";
import { AppError } from "../errors/AppError.js";

function parseUserData(userObject: NonNullable<Awaited<ReturnType<typeof findUser>>>) {
    return {
        id: userObject.id,
        name: userObject.username,
        email: userObject.email,
        profileImageUrl: userObject.profileImageUrl,
        updatedAt: userObject.updatedAt
    };
}

function validateName(name: unknown): string {
    if (typeof name !== "string") {
        throw new AppError(
            "Name is required.",
            "NAME_REQUIRED",
            400
        );
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
        throw new AppError(
            "Name is required.",
            "NAME_REQUIRED",
            400
        );
    }

    if (trimmedName.length > 80) {
        throw new AppError(
            "Name cannot exceed 80 characters.",
            "NAME_TOO_LONG",
            400
        );
    }

    return trimmedName;
}

export async function handleGetUser(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const userObject = await findUser(userId);
    if (!userObject) {
        throw new AppError(
            "User not found",
            "USER_NOT_FOUND",
            404
        );
    }

    return res.status(200).json({
        success: true,
        data: {
            user: parseUserData(userObject)
        }
    });
}

export async function handleUpdateCurrentUser(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const username = validateName(req.body.name);
    const updatedUser = await updateUserProfile(userId, { username });

    return res.status(200).json({
        success: true,
        data: {
            user: parseUserData(updatedUser)
        }
    });
}
