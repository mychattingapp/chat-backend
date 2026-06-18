import { S3, bucket } from '../config/r2Client.js'
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { FileType } from '../controllers/imageController.js'
import { AppError } from '../errors/AppError.js';

const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function generatePresignedUrl(key: string, contentType: FileType) {
    const putUrl = await getSignedUrl(
        S3,
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
        }),
        { expiresIn: 300 },
    )

    return putUrl;
}

export async function verifyImageUpload(key: string) {
    let imageMetadata;

    try {
        imageMetadata = await S3.send(
            new HeadObjectCommand({
                Bucket: bucket,
                Key: key,
            })
        );
    }
    catch (error) {
        throw new AppError(
            "Avatar upload not found.",
            "UPLOAD_NOT_FOUND",
            400
        );
    }

    if (!imageMetadata.ContentType || !ALLOWED_FILE_TYPES.includes(imageMetadata.ContentType)) {
        await deleteImageObject(key);
        throw new AppError(
            "Unsupported image format.",
            "INVALID_FILE_TYPE",
            400
        );
    }

    if (!imageMetadata.ContentLength || imageMetadata.ContentLength > MAX_FILE_SIZE) {
        await deleteImageObject(key);
        throw new AppError(
            "Image cannot exceed 5 MB.",
            "FILE_TOO_LARGE",
            400
        );
    }
}

async function deleteImageObject(key: string) {
    await S3.send(
        new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        })
    );
}
