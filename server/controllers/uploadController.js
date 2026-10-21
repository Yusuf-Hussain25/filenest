import crypto from "crypto";
import path from "path";
import { sql } from "../config/db.js";
import { deleteFromStorage, deleteMultipleFromStorage, getObjectSize, getUploadUrl } from "../utils/s3Helper.js";
import { cleanName, parseFolderRef, serverError } from "../utils/http.js";
import { MAX_FILE_SIZE } from "../middleware/upload.js";
import { publicFile } from "./fileController.js";

// Direct uploads: the browser asks for a presigned URL, PUTs the file straight to storage,
// then asks the API to finish. The file only counts (and uses quota) once the API has seen
// the stored object and its size matches what was promised.

const UPLOAD_WINDOW_SECONDS = 3600;

const quotaError = (user) =>
    `Not enough space: this upload would go over your ${(Number(user.storage_limit) / 1073741824).toFixed(1)} GB storage limit.`;

// Drops unfinished uploads whose URL has expired (anyone's, a batch at a time) and whatever they
// left in storage. Runs whenever an upload starts, so abandoned uploads don't pile up.
const clearExpired = async () => {
    const stale = await sql`
    DELETE FROM pending_uploads WHERE id IN (SELECT id FROM pending_uploads WHERE expires_at < NOW() LIMIT 100)
    RETURNING s3_key`;
    if (stale.length) await deleteMultipleFromStorage(stale.map((s) => s.s3_key)).catch(() => {});
};

// Start an upload
// POST /api/files/uploads   { name, size, type, folder_id }
export const createUpload = async (req, res) => {
    try {
        const { name, error } = cleanName(typeof req.body?.name === "string" ? req.body.name.replace(/[/\\]/g, "_") : "", "File name");
        if (error) return res.status(400).json({ error });

        const size = Number(req.body?.size);
        if (!Number.isSafeInteger(size) || size < 0) {
            return res.status(400).json({ error: "File size is missing or invalid." });
        }
        if (size > MAX_FILE_SIZE) {
            return res.status(413).json({ error: `Each file can be at most ${Math.round(MAX_FILE_SIZE / 1048576)} MB.` });
        }

        const mimeType = typeof req.body?.type === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(req.body.type)
            ? req.body.type.slice(0, 128)
            : "application/octet-stream";

        const folderId = parseFolderRef(req.body?.folder_id ?? req.body?.folderId);
        if (folderId === undefined) return res.status(404).json({ error: "Target folder not found." });
        if (folderId) {
            const [folder] = await sql`SELECT id FROM folders WHERE id = ${folderId} AND owner_id = ${req.user.id} AND is_trashed = false`;
            if (!folder) return res.status(404).json({ error: "Target folder not found." });
        }

        await clearExpired();

        // Early quota check, counting uploads still in flight (completion re-checks atomically)
        const [{ pending }] = await sql`SELECT COALESCE(SUM(size), 0)::bigint AS pending FROM pending_uploads WHERE owner_id = ${req.user.id} AND expires_at > NOW()`;
        if (Number(req.user.storage_used) + Number(pending) + size > Number(req.user.storage_limit)) {
            return res.status(400).json({ error: quotaError(req.user) });
        }

        const ext = path.extname(name).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16);
        const s3Key = `users/${req.user.id}/${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
        const [upload] = await sql`
        INSERT INTO pending_uploads (owner_id, folder_id, name, mime_type, size, s3_key, expires_at)
        VALUES (${req.user.id}, ${folderId}, ${name}, ${mimeType}, ${size}, ${s3Key}, NOW() + make_interval(secs => ${UPLOAD_WINDOW_SECONDS}))
        RETURNING id`;

        const url = await getUploadUrl(s3Key, mimeType, size, UPLOAD_WINDOW_SECONDS);
        return res.status(201).json({ upload_id: upload.id, url, method: "PUT", headers: { "Content-Type": mimeType } });
    } catch (error) {
        return serverError(res, error);
    }
};

// Finish an upload after the browser's PUT succeeded
// POST /api/files/uploads/:id/complete
export const completeUpload = async (req, res) => {
    try {
        const [upload] = await sql`
        SELECT * FROM pending_uploads WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND expires_at > NOW()`;
        if (!upload) return res.status(404).json({ error: "Upload not found or expired. Try again." });

        const discard = async () => {
            await sql`DELETE FROM pending_uploads WHERE id = ${upload.id}`;
            await deleteFromStorage(upload.s3_key).catch(() => {});
        };

        const stored = await getObjectSize(upload.s3_key);
        if (stored === null) return res.status(409).json({ error: "The file hasn't reached storage yet." });
        if (stored !== Number(upload.size)) {
            await discard();
            return res.status(400).json({ error: "The uploaded file doesn't match what was announced." });
        }

        // Count it against the quota atomically, so parallel uploads can't go over
        const [user] = await sql`
        UPDATE users SET storage_used = storage_used + ${upload.size}, updated_at = NOW()
        WHERE id = ${req.user.id} AND storage_used + ${upload.size} <= storage_limit
        RETURNING storage_used`;
        if (!user) {
            await discard();
            return res.status(400).json({ error: quotaError(req.user) });
        }

        // If the folder went to the Trash meanwhile, the file lands in My Files instead of vanishing
        const [file] = await sql`
        INSERT INTO files (name, original_name, mime_type, size, s3_key, folder_id, owner_id)
        VALUES (${upload.name}, ${upload.name}, ${upload.mime_type}, ${upload.size}, ${upload.s3_key},
            (SELECT id FROM folders WHERE id = ${upload.folder_id} AND owner_id = ${req.user.id} AND is_trashed = false),
            ${req.user.id})
        RETURNING *`;
        await sql`DELETE FROM pending_uploads WHERE id = ${upload.id}`;

        return res.status(201).json({ file: publicFile(file), storage_used: Number(user.storage_used) });
    } catch (error) {
        return serverError(res, error);
    }
};

// Cancel an upload (removes anything already stored)
// DELETE /api/files/uploads/:id
export const cancelUpload = async (req, res) => {
    try {
        const [upload] = await sql`DELETE FROM pending_uploads WHERE id = ${req.params.id} AND owner_id = ${req.user.id} RETURNING s3_key`;
        if (!upload) return res.status(404).json({ error: "Upload not found." });
        await deleteFromStorage(upload.s3_key).catch(() => {});
        return res.status(200).json({ message: "Upload canceled." });
    } catch (error) {
        return serverError(res, error);
    }
};
