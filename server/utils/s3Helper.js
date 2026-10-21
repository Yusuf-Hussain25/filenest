import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectVersionsCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { BUCKET_NAME, client } from "../config/s3.js"
import {getSignedUrl} from "@aws-sdk/s3-request-presigner"


// Upload file to S3-compatible storage
export const uploadToStorage = async (fileBuffer, key, mimeType) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType
    });
    await client.send(command)
    return {s3Key: key};
}

// Content-Disposition with a UTF-8 file name (RFC 6266 / 5987)
const contentDisposition = (type, filename) => {
    const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
    return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

// Presigned URL for a file, valid for 1 hour. `download` makes browsers save it under its
// Filenest name instead of opening it.
export const getSignedFileUrl = async (key, { download = false, filename } = {}) => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ...(filename ? { ResponseContentDisposition: contentDisposition(download ? "attachment" : "inline", filename) } : {}),
    });
    return await getSignedUrl(client, command, {expiresIn: 3600})
}

// Permanently delete an object and its versions from storage
export const deleteFromStorage = async (key) => {
     if (!key) return;
     try {
        const {Versions = [], DeleteMarkers = []} = await client.send(
            new ListObjectVersionsCommand({Bucket: BUCKET_NAME, Prefix: key})
        );

        const Objects = [...Versions, ...DeleteMarkers].filter((v)=> v.Key === key).map(({Key, VersionId})=> ({Key, VersionId}));

        if (Objects.length > 0){
            await client.send(new DeleteObjectsCommand({Bucket: BUCKET_NAME, Delete: { Objects }}));
        }else{
            await client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }))
        }
     } catch (err) {
        try {
            await client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        } catch (fallbackErr) {
             console.error("[Storage Delete Error]:", fallbackErr.message);
             throw fallbackErr;
        }
     }
}

// Batch permanently delete multiple keys from storage
export const deleteMultipleFromStorage  = async (keys) => {
    if(!keys?.length) return;
    await Promise.all(keys.map(deleteFromStorage))
}