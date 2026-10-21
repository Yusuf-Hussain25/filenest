// Prepares the bucket from .env: creates it if needed, turns on versioning, and sets CORS so
// browsers on ORIGINS can upload straight to it with presigned URLs. Safe to re-run, and works
// against the local S3 server as well as Cloudflare R2 or AWS S3.
import 'dotenv/config';
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand, PutBucketVersioningCommand } from '@aws-sdk/client-s3';
import { BUCKET_NAME, client } from '../config/s3.js';

const origins = (process.env.ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim()).filter(Boolean);

try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`Bucket "${BUCKET_NAME}" already exists`);
} catch {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`Created bucket "${BUCKET_NAME}"`);
}

try {
    await client.send(new PutBucketVersioningCommand({
        Bucket: BUCKET_NAME,
        VersioningConfiguration: { Status: 'Enabled' },
    }));
} catch (err) {
    console.warn('Could not enable versioning:', err.message);
}

try {
    await client.send(new PutBucketCorsCommand({
        Bucket: BUCKET_NAME,
        CORSConfiguration: {
            CORSRules: [{
                AllowedOrigins: origins,
                AllowedMethods: ['PUT', 'GET', 'HEAD'],
                AllowedHeaders: ['*'],
                ExposeHeaders: ['ETag'],
                MaxAgeSeconds: 3600,
            }],
        },
    }));
    console.log(`CORS allows uploads from ${origins.join(', ')}`);
} catch (err) {
    console.warn('Could not set CORS (direct uploads need it; set VITE_UPLOAD_MODE="server" otherwise):', err.message);
}
