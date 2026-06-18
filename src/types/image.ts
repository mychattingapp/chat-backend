export const ALLOWED_IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg"] as const;
export const IMAGE_UPLOAD_PURPOSES = ["avatar", "message"] as const;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type ImageContentType = typeof ALLOWED_IMAGE_CONTENT_TYPES[number];
export type ImageUploadPurpose = typeof IMAGE_UPLOAD_PURPOSES[number];
