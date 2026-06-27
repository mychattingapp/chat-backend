import { S3, bucket, cloudflareUrl } from '../config/r2Client.js'
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { AppError } from '../errors/AppError.js';
import { ALLOWED_IMAGE_CONTENT_TYPES, MAX_IMAGE_SIZE_BYTES, type ImageContentType } from '../types/image.js';

const PROVIDER_IMAGE_FETCH_TIMEOUT_MS = 5000;

export async function generatePresignedUrl(key: string, contentType: ImageContentType) {
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

export async function generatePresignedReadUrl(key: string) {
    return getSignedUrl(
        S3,
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        }),
        { expiresIn: 300 },
    );
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
            "Image upload not found.",
            "UPLOAD_NOT_FOUND",
            400
        );
    }

    const contentType = imageMetadata.ContentType;

    if (!isAllowedImageContentType(contentType)) {
        await deleteImageObject(key);
        throw new AppError(
            "Unsupported image format.",
            "INVALID_FILE_TYPE",
            400
        );
    }

    if (!imageMetadata.ContentLength || imageMetadata.ContentLength > MAX_IMAGE_SIZE_BYTES) {
        await deleteImageObject(key);
        throw new AppError(
            "Image cannot exceed 5 MB.",
            "FILE_TOO_LARGE",
            400
        );
    }

    return {
        contentType,
        contentLength: imageMetadata.ContentLength ?? null,
    };
}

async function deleteImageObject(key: string) {
    await S3.send(
        new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        })
    );
}

export async function uploadProviderImageToR2(userId: string, profileImageUrl: string) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), PROVIDER_IMAGE_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(profileImageUrl, {
            signal: abortController.signal,
        });

        const contentType = validateProviderImageResponse(response);

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        validateProviderImageBuffer(imageBuffer);

        const key = `avatars/${userId}`;

        await S3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: imageBuffer,
                ContentType: contentType,
            })
        );

        return `${cloudflareUrl}/${key}`;
    }
    finally {
        clearTimeout(timeoutId);
    }
}

function isAllowedImageContentType(contentType: string | undefined | null): contentType is ImageContentType {
    return !!contentType && ALLOWED_IMAGE_CONTENT_TYPES.includes(contentType as ImageContentType);
}

function validateProviderImageResponse(response: Response): ImageContentType {
    if (!response.ok) {
        throw new Error("Failed to download provider profile image.");
    }

    const contentType = response.headers.get("content-type");

    if (!isAllowedImageContentType(contentType)) {
        throw new Error("Unsupported provider profile image type.");
    }

    const declaredContentLength = Number(response.headers.get("content-length"));

    if (Number.isFinite(declaredContentLength) && declaredContentLength > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("Provider profile image is too large.");
    }

    return contentType;
}

function validateProviderImageBuffer(imageBuffer: Buffer) {
    if (imageBuffer.length > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("Provider profile image is too large.");
    }
}
