import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { requireEnv } from "./env.js";

dotenv.config();

const cloudflareEndpoint = requireEnv('CLOUDFLARE_R2_ENDPOINT');
const accessKey = requireEnv('CLOUDFLARE_R2_ACCESS_KEY');
const secretKey = requireEnv('CLOUDFLARE_R2_SECRET_KEY');
const bucket = requireEnv('CLOUDFLARE_R2_BUCKET')
const cloudflareUrl = requireEnv('CLOUDFLARE_R2_PUBLIC_URL')

const S3 = new S3Client({
    region: "auto",
    endpoint: cloudflareEndpoint,
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
    },
});

export { S3, bucket, cloudflareUrl }