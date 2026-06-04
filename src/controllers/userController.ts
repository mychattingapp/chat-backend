import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/express.js";
import { findUser } from "../services/userService.js";
import { AppError } from "../errors/AppError.js";

export async function getUser(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const userObject = await findUser(userId);
    if (!userObject) {
        throw new AppError("User not found", "USER_NOT_FOUND", 404);
    }

    const userData = {
        id: userObject.id,
        name: userObject.username,
        email: userObject.email,
    };
    return res.status(200).json({
        success: true,
        data: {
            user: userData
        }
    });
}
