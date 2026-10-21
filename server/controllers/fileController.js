import { sql } from "../config/db.js";
import path from 'path'
import crypto from 'crypto'
import { deleteMultipleFromStorage, getSignedFileUrl, uploadToStorage } from "../utils/s3Helper.js";
import { adjustUserStorage, cleanupShareLinks, permanentDeleteFileRecord } from "../services/storageService.js";
import { cleanName, parseFolderRef, serverError } from "../utils/http.js";

const SORT_MAP = {
    name_asc: "name ASC",
    name_desc: "name DESC",
    date_asc: "created_at ASC",
    date_desc: "created_at DESC",
    size_asc: "size ASC",
    size_desc: "size DESC",
}

// File row without the internal storage key
export const publicFile = ({ s3_key: _s3Key, ...file }) => file;

// Multer reads multipart file names as latin1; turn them back into UTF-8 (e.g. "café.pdf")
const decodeName = (name) => {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    return decoded.includes("�") ? name : decoded;
};

// Upload file(s)
// POST /api/files/upload
export const uploadFiles = async (req, res) => {
    let reservedBytes = 0;
    const storedKeys = [];
    try {
        if(!req.files?.length){
            return res.status(400).json({ error: "No files uploaded." });
        }

        const targetFolderId = parseFolderRef(req.body.folder_id ?? req.body.folderId);
        if (targetFolderId === undefined) {
            return res.status(404).json({ error: "Target folder not found." });
        }

        if(targetFolderId){
            const [folder] = await sql`
            SELECT id FROM folders
            WHERE id = ${targetFolderId} AND owner_id = ${req.user.id} AND is_trashed = false
            `;
            if(!folder){
                return res.status(404).json({ error: "Target folder not found." });
            }
        }

        const totalNewBytes = req.files.reduce((acc, f)=>acc + f.size, 0)

        // Reserve the space atomically so parallel uploads can't go over the quota together
        const [reserved] = await sql`
        UPDATE users SET storage_used = storage_used + ${totalNewBytes}, updated_at = NOW()
        WHERE id = ${req.user.id} AND storage_used + ${totalNewBytes} <= storage_limit
        RETURNING storage_used
        `;
        if(!reserved){
            const limitGb = (Number(req.user.storage_limit) / (1024 * 1024 * 1024)).toFixed(1);
            return res.status(400).json({ error: `Not enough space: this upload would go over your ${limitGb} GB storage limit.` });
        }
        reservedBytes = totalNewBytes;

        // Store each file, then record them all in the database
        const prepared = await Promise.all(
            req.files.map(async (multerFile)=>{
                const name = decodeName(multerFile.originalname).replace(/[/\\]/g, "_").slice(0, 255) || "Untitled";
                const fileExt = path.extname(name).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16);
                const randomString = crypto.randomBytes(8).toString("hex");
                const s3Key = `users/${req.user.id}/${Date.now()}_${randomString}${fileExt}`
                const mimeType = (multerFile.mimetype || "application/octet-stream").slice(0, 128);
                await uploadToStorage(multerFile.buffer, s3Key, mimeType)
                storedKeys.push(s3Key);
                return { name, mimeType, size: multerFile.size, s3Key };
            })
        )

        const createdFiles = await Promise.all(prepared.map(async ({ name, mimeType, size, s3Key }) => {
            const [row] = await sql`
            INSERT INTO files (name, original_name, mime_type, size, s3_key, folder_id, owner_id) VALUES (${name}, ${name}, ${mimeType}, ${size}, ${s3Key}, ${targetFolderId}, ${req.user.id}) RETURNING *
            `;
            return publicFile(row);
        }))

        return res.status(201).json({ files: createdFiles, storage_used: Number(reserved.storage_used) });

    } catch (error) {
        // Undo partial work: remove stored objects, rows and the reserved space
        if (storedKeys.length) {
            await sql`DELETE FROM files WHERE s3_key = ANY(${storedKeys})`.catch(() => {});
            await deleteMultipleFromStorage(storedKeys).catch(() => {});
        }
        if (reservedBytes) await adjustUserStorage(req.user.id, -reservedBytes).catch(() => {});
        return serverError(res, error);
    }
}

// Get files in folder, or search all files
// GET /api/files
export const getFiles = async (req, res) => {
    try {
        const {folder, folder_id, search, sort = "name_asc", page = 1, limit = 50} = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        const orderBy = SORT_MAP[sort] || SORT_MAP.name_asc;

        const targetFolderId = parseFolderRef(folder_id ?? folder);
        if (targetFolderId === undefined) {
            return res.status(404).json({ error: "Folder not found." });
        }
        const term = typeof search === "string" ? search.trim().slice(0, 100) : "";
        const isSearch = Boolean(term)
        // Escape LIKE wildcards so "100%" searches for the text, not a pattern
        const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;

        const [rows, countRows] = await Promise.all([
            sql`
            SELECT f.*, EXISTS (
                SELECT 1 FROM share_links s WHERE s.resource_id = f.id AND (s.expires_at IS NULL OR s.expires_at > NOW())
            ) AS is_shared
            FROM files f
            WHERE owner_id = ${req.user.id} AND is_trashed = false
            AND (${isSearch}::boolean = true AND name ILIKE ${pattern} OR ${isSearch}::boolean = false AND folder_id IS NOT DISTINCT FROM ${targetFolderId})
            ORDER BY ${sql.unsafe(orderBy)}
            LIMIT ${limitNum} OFFSET ${offset}
            `,

            sql`
            SELECT COUNT(*)::int AS total FROM files
            WHERE owner_id = ${req.user.id} AND is_trashed = false
            AND (${isSearch}::boolean = true AND name ILIKE ${pattern} OR ${isSearch}::boolean = false AND folder_id IS NOT DISTINCT FROM ${targetFolderId})
            `,
        ])

        const totalFiles = countRows[0].total;

        return res.status(200).json({
            files: rows.map(publicFile),
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalFiles,
                totalPages: Math.ceil(totalFiles / limitNum),
            }
        })

    } catch (error) {
        return serverError(res, error);
    }
}

// Get presigned preview URL, or a download URL with ?download=1
// GET /api/files/:id/preview
export const getFilePreviewUrl = async (req, res) => {
    try {
        const [file] = await sql`
        SELECT * FROM files WHERE id = ${req.params.id} AND owner_id = ${req.user.id}
        `;

        if(!file){
            return res.status(404).json({ error: "File not found." });
        }
        const download = req.query.download === "1" || req.query.download === "true";
        const url = await getSignedFileUrl(file.s3_key, { download, filename: file.name })
        // Feeds "Recent"
        await sql`UPDATE files SET last_opened_at = NOW() WHERE id = ${file.id}`;
        return res.status(200).json({ url, file: publicFile(file) });

    } catch (error) {
        return serverError(res, error);
    }
}

// Rename file
// PATCH /api/files/:id/rename
export const renameFile = async (req, res) => {
    try {
        const { name, error } = cleanName(req.body?.name, "File name");
        if(error){
            return res.status(400).json({ error });
        }
        const [file] = await sql`
            UPDATE files
            SET name = ${name}, updated_at = NOW()
            WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = false
            RETURNING *
        `;

        if(!file){
             return res.status(404).json({ error: "File not found." });
        }

        return res.status(200).json({ file: publicFile(file) });

    } catch (error) {
        return serverError(res, error);
    }
}

// Move file to different folder
// PATCH /api/files/:id/move
export const moveFile = async (req, res) => {
    try {
        const targetFolder = parseFolderRef(req.body?.target_folder ?? req.body?.targetFolder);

        if (targetFolder === undefined) {
            return res.status(404).json({ error: "Destination folder not found." });
        }

        if (targetFolder) {
            const [destFolder] = await sql`
            SELECT id FROM folders
            WHERE id = ${targetFolder} AND owner_id = ${req.user.id} AND is_trashed = false
            `;

            if(!destFolder){
               return res.status(404).json({ error: "Destination folder not found." });
            }
        }

        const [file] = await sql`
        UPDATE files
        SET folder_id = ${targetFolder}, updated_at = NOW()
        WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = false
        RETURNING *
        `;

        if (!file){
            return res.status(404).json({ error: "File not found." });
        }

        return res.status(200).json({ file: publicFile(file) });
    } catch (error) {
        return serverError(res, error);
    }
}

// Soft delete file
// DELETE /api/files/:id
export const softDeleteFile = async (req, res) => {
    try {
        const [file] = await sql`
        UPDATE files
        SET is_trashed = true, trashed_at = NOW(), updated_at = NOW()
        WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = false
        RETURNING *
        `;

        if(!file){
             return res.status(404).json({ error: "File not found." });
        }

        await cleanupShareLinks([file.id], [])
        return res.status(200).json({ message: "File moved to Trash." });
    } catch (error) {
        return serverError(res, error);
    }
}

// Restore file from Trash. If its folder is gone or still in the Trash, it goes back to My Files.
// POST /api/files/:id/restore
export const restoreFile = async (req, res) => {
    try {
        const [file] = await sql`
            UPDATE files f
            SET is_trashed = false, trashed_at = NULL, updated_at = NOW(),
                folder_id = CASE
                    WHEN f.folder_id IS NULL THEN NULL
                    WHEN EXISTS (SELECT 1 FROM folders p WHERE p.id = f.folder_id AND p.is_trashed = false) THEN f.folder_id
                    ELSE NULL
                END
            WHERE f.id = ${req.params.id} AND f.owner_id = ${req.user.id} AND f.is_trashed = true
            RETURNING f.id, f.folder_id
        `;

        if(!file){
            return res.status(404).json({ error: "File not found in Trash." });
        }

        return res.status(200).json({ message: "File restored.", folder_id: file.folder_id });
    } catch (error) {
        return serverError(res, error);
    }
}

// Permanently delete file
// DELETE /api/files/:id/permanent
export const permanentDeleteFile = async (req, res) => {
    try {
         const [file] = await sql`
         SELECT * FROM files WHERE id = ${req.params.id} AND owner_id = ${req.user.id}
         `;

         if(!file){
            return res.status(404).json({ error: "File not found." });
         }

         await permanentDeleteFileRecord(file, req.user.id)
         return res.status(200).json({ message: "File permanently deleted." });
    } catch (error) {
        return serverError(res, error);
    }
}
