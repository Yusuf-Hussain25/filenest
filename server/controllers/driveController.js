import { sql } from "../config/db.js";
import { serverError } from "../utils/http.js";
import { listedFile } from "./fileController.js";

// SQL expression that sorts a file into one of the storage categories shown in the app
const CATEGORY = sql.unsafe(`CASE
    WHEN mime_type LIKE 'image/%' THEN 'images'
    WHEN mime_type LIKE 'video/%' THEN 'videos'
    WHEN mime_type LIKE 'audio/%' THEN 'audio'
    WHEN mime_type ~ '(zip|tar|rar|7z|gzip|compressed)' THEN 'archives'
    WHEN mime_type = 'application/pdf' OR mime_type LIKE 'text/%'
      OR mime_type ~ '(word|document|sheet|excel|presentation|powerpoint|csv|json|rtf|opendocument)' THEN 'documents'
    ELSE 'other'
END`);

// Recently uploaded, edited or opened files, newest first, with the folder they live in
// GET /api/drive/recent
export const getRecent = async (req, res) => {
    try {
        const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 30));
        const rows = await sql`
        SELECT f.*, p.name AS folder_name,
            GREATEST(f.created_at, f.updated_at, COALESCE(f.last_opened_at, f.created_at)) AS activity_at,
            CASE
                WHEN f.last_opened_at IS NOT NULL AND f.last_opened_at >= GREATEST(f.created_at, f.updated_at) THEN 'opened'
                WHEN f.updated_at > f.created_at + interval '1 second' THEN 'edited'
                ELSE 'uploaded'
            END AS activity
        FROM files f
        LEFT JOIN folders p ON p.id = f.folder_id
        WHERE f.owner_id = ${req.user.id} AND f.is_trashed = false
        ORDER BY activity_at DESC
        LIMIT ${limit}`;
        return res.status(200).json({ files: await Promise.all(rows.map(listedFile)) });
    } catch (error) {
        return serverError(res, error);
    }
}

// Starred files and folders
// GET /api/drive/starred
export const getStarred = async (req, res) => {
    try {
        const [files, folders] = await Promise.all([
            sql`
            SELECT f.*, p.name AS folder_name FROM files f
            LEFT JOIN folders p ON p.id = f.folder_id
            WHERE f.owner_id = ${req.user.id} AND f.is_starred = true AND f.is_trashed = false
            ORDER BY f.name ASC`,
            sql`
            SELECT f.*, p.name AS folder_name FROM folders f
            LEFT JOIN folders p ON p.id = f.parent_id
            WHERE f.owner_id = ${req.user.id} AND f.is_starred = true AND f.is_trashed = false
            ORDER BY f.name ASC`,
        ]);
        return res.status(200).json({ files: await Promise.all(files.map(listedFile)), folders });
    } catch (error) {
        return serverError(res, error);
    }
}

// Search file and folder names across the whole drive
// GET /api/drive/search?q=
export const searchDrive = async (req, res) => {
    try {
        const term = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
        if (!term) return res.status(200).json({ files: [], folders: [] });
        const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;

        const [files, folders] = await Promise.all([
            sql`
            SELECT f.*, p.name AS folder_name FROM files f
            LEFT JOIN folders p ON p.id = f.folder_id
            WHERE f.owner_id = ${req.user.id} AND f.is_trashed = false AND f.name ILIKE ${pattern}
            ORDER BY (lower(f.name) LIKE lower(${`${term}%`})) DESC, f.updated_at DESC
            LIMIT 40`,
            sql`
            SELECT f.*, p.name AS folder_name FROM folders f
            LEFT JOIN folders p ON p.id = f.parent_id
            WHERE f.owner_id = ${req.user.id} AND f.is_trashed = false AND f.name ILIKE ${pattern}
            ORDER BY (lower(f.name) LIKE lower(${`${term}%`})) DESC, f.name ASC
            LIMIT 20`,
        ]);
        return res.status(200).json({ files: await Promise.all(files.map(listedFile)), folders });
    } catch (error) {
        return serverError(res, error);
    }
}

// Every live folder (id, name, parent) for the "Move to" picker
// GET /api/drive/folders
export const getFolderTree = async (req, res) => {
    try {
        const folders = await sql`
        SELECT id, name, parent_id, path FROM folders
        WHERE owner_id = ${req.user.id} AND is_trashed = false
        ORDER BY name ASC`;
        return res.status(200).json({ folders });
    } catch (error) {
        return serverError(res, error);
    }
}

// Storage overview: usage by category, item counts and uploads over the last 14 days
// GET /api/drive/stats
export const getStats = async (req, res) => {
    try {
        const [categories, [counts], days] = await Promise.all([
            sql`
            SELECT ${CATEGORY} AS key, COUNT(*)::int AS count, COALESCE(SUM(size), 0)::bigint AS size
            FROM files
            WHERE owner_id = ${req.user.id} AND is_trashed = false
            GROUP BY 1`,
            sql`
            SELECT
                (SELECT COUNT(*)::int FROM files WHERE owner_id = ${req.user.id} AND is_trashed = false) AS files,
                (SELECT COUNT(*)::int FROM folders WHERE owner_id = ${req.user.id} AND is_trashed = false) AS folders,
                (SELECT COUNT(*)::int FROM files WHERE owner_id = ${req.user.id} AND is_trashed = false AND is_starred = true)
                  + (SELECT COUNT(*)::int FROM folders WHERE owner_id = ${req.user.id} AND is_trashed = false AND is_starred = true) AS starred,
                (SELECT COUNT(*)::int FROM share_links WHERE owner_id = ${req.user.id} AND (expires_at IS NULL OR expires_at > NOW())) AS shared,
                (SELECT COALESCE(SUM(access_count), 0)::int FROM share_links WHERE owner_id = ${req.user.id}) AS link_views,
                (SELECT COUNT(*)::int FROM files WHERE owner_id = ${req.user.id} AND is_trashed = true) AS trash_files,
                (SELECT COALESCE(SUM(size), 0)::bigint FROM files WHERE owner_id = ${req.user.id} AND is_trashed = true) AS trash_size`,
            sql`
            SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COUNT(f.id)::int AS count, COALESCE(SUM(f.size), 0)::bigint AS size
            FROM generate_series(date_trunc('day', NOW()) - interval '13 days', date_trunc('day', NOW()), interval '1 day') AS d(day)
            LEFT JOIN files f ON f.owner_id = ${req.user.id} AND date_trunc('day', f.created_at) = d.day
            GROUP BY d.day
            ORDER BY d.day`,
        ]);

        return res.status(200).json({
            storage_used: Number(req.user.storage_used),
            storage_limit: Number(req.user.storage_limit),
            categories: categories.map((c) => ({ key: c.key, count: c.count, size: Number(c.size) })),
            counts: { ...counts, trash_size: Number(counts.trash_size) },
            uploads: days.map((d) => ({ day: d.day, count: d.count, size: Number(d.size) })),
        });
    } catch (error) {
        return serverError(res, error);
    }
}

// Star or unstar a file or folder
// PATCH /api/files/:id/star, PATCH /api/folders/:id/star   { starred: boolean }
export const setStarred = (table) => async (req, res) => {
    try {
        const starred = req.body?.starred;
        if (typeof starred !== "boolean") {
            return res.status(400).json({ error: "starred must be true or false." });
        }
        const [row] = table === "files"
            ? await sql`UPDATE files SET is_starred = ${starred} WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = false RETURNING id, is_starred`
            : await sql`UPDATE folders SET is_starred = ${starred} WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = false RETURNING id, is_starred`;
        if (!row) {
            return res.status(404).json({ error: `${table === "files" ? "File" : "Folder"} not found.` });
        }
        return res.status(200).json(row);
    } catch (error) {
        return serverError(res, error);
    }
}
