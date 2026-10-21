// Creates the configured bucket (with versioning) on the S3 endpoint from .env.
// Safe to re-run. Used for the local S3 server in docker-compose.dev.yml.
import { CreateBucketCommand, HeadBucketCommand, PutBucketVersioningCommand } from '@aws-sdk/client-s3';
import { BUCKET_NAME, client } from '../config/s3.js';

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
