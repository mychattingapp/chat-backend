import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/express.js";
import { AppError } from "../errors/AppError.js";
import { generatePresignedUrl, verifyImageUpload } from "../services/imageService.js";
import { updateUserProfileImageUrl } from "../services/userService.js";
import { cloudflareUrl } from "../config/r2Client.js";
import { randomUUID } from "crypto";

const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg"] as const;
const ALLOWED_UPLOAD_PURPOSES = ['message', 'avatar'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024

export type FileType = typeof ALLOWED_FILE_TYPES[number];
type UploadPurpose = typeof ALLOWED_UPLOAD_PURPOSES[number];

function validateFileMetadata(fileType: any, fileSize: any, purpose: any) {
    if (!fileType || typeof fileType !== "string" || !ALLOWED_FILE_TYPES.includes(fileType as FileType)) {
        throw new AppError(
            "Unsupported image format.",
            "INVALID_FILE_TYPE",
            400
        )
    }
    if (!fileSize || typeof fileSize !== "number") {
        throw new AppError(
            "File size is invalid.",
            "INVALID_FILE_SIZE",
            400
        )
    }
    if (fileSize > MAX_FILE_SIZE) {
        throw new AppError(
            "Image cannot exceed 5 MB.",
            "FILE_TOO_LARGE",
            400
        )
    }
    if (typeof purpose !== 'string' || !ALLOWED_UPLOAD_PURPOSES.includes(purpose as UploadPurpose)) {
        throw new AppError(
            "Upload purpose is invalid.",
            "INVALID_UPLOAD_PURPOSE",
            400
        )
    }

    return {
        fileType: fileType as FileType,
        purpose: purpose as UploadPurpose
    }
}

export async function handleGetPresignedUrl(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;

    const { fileType, purpose } = validateFileMetadata(
        req.body.fileType,
        req.body.fileSize,
        req.body.purpose
    );

    const key = purpose === "avatar"
        ? `avatars/${userId}`
        : `message-images/${userId}/${randomUUID()}`;

    const preSignedUrl = await generatePresignedUrl(key, fileType)

    return res.status(200).json({
        success: true,
        data: {
            uploadUrl: preSignedUrl,
            contentType: fileType,
            ...(purpose === "message" && { key })
        }
    })
}

export async function handleSetProfileImageUrl(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.id;
    const profileImageUrl = `${cloudflareUrl}/avatars/${userId}`;

    await verifyImageUpload(`avatars/${userId}`)
    const user = await updateUserProfileImageUrl(userId, profileImageUrl);

    res.status(200).json({
        success: true,
        data: {
            user
        }
    })
}
