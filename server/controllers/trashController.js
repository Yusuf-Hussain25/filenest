import { sql } from "../config/db.js"
import { emptyTrashHierarchy } from "../services/storageService.js";
import { serverError } from "../utils/http.js";
import { publicFile } from "./fileController.js";

// Trashed files and folders as the user trashed them: things that went to the Trash together
// with a folder are shown through that folder (with a count of what it holds), not one by one.
// GET /api/trash
export const getTrashItems = async (req, res) => {
    try {
        const [files, folders] = await Promise.all([
            sql`
            SELECT f.* FROM files f
            LEFT JOIN folders p ON p.id = f.folder_id
            WHERE f.owner_id = ${req.user.id} AND f.is_trashed = true
              AND (p.id IS NULL OR p.is_trashed = false OR p.trashed_at IS DISTINCT FROM f.trashed_at)
            ORDER BY f.trashed_at DESC
            `,
            sql`
            SELECT fo.*,
                (SELECT COUNT(*)::int FROM files fi
                  WHERE fi.owner_id = fo.owner_id AND fi.is_trashed = true AND fi.trashed_at = fo.trashed_at
                    AND (fi.folder_id = fo.id OR fi.folder_id IN (SELECT d.id FROM folders d WHERE fo.id = ANY(d.path)))) AS file_count,
                (SELECT COALESCE(SUM(fi.size), 0)::bigint FROM files fi
                  WHERE fi.owner_id = fo.owner_id AND fi.is_trashed = true AND fi.trashed_at = fo.trashed_at
                    AND (fi.folder_id = fo.id OR fi.folder_id IN (SELECT d.id FROM folders d WHERE fo.id = ANY(d.path)))) AS total_size
            FROM folders fo
            LEFT JOIN folders p ON p.id = fo.parent_id
            WHERE fo.owner_id = ${req.user.id} AND fo.is_trashed = true
              AND (p.id IS NULL OR p.is_trashed = false OR p.trashed_at IS DISTINCT FROM fo.trashed_at)
            ORDER BY fo.trashed_at DESC
            `
        ])
        return res.status(200).json({ files: files.map(publicFile), folders })
    } catch (error) {
        return serverError(res, error);
    }
}

// Empty user trash (permanently delete all trashed items)
// POST /api/trash/empty
export const emptyTrash = async (req, res) => {
    try {
        await emptyTrashHierarchy(req.user.id);
        return res.status(200).json({ message: "Trash emptied." });
    } catch (error) {
        return serverError(res, error);
    }
}
