import { sql } from "../config/db.js";
import { cleanupShareLinks, rebaseFolderPaths, softDeleteFolderHierarchy } from "../services/storageService.js";
import { isUuid, parseFolderRef, serverError } from "../utils/http.js";

const ACTIONS = ["trash", "star", "unstar", "move"];

// One action on many files and folders at once (multi-select).
// POST /api/drive/bulk   { action, files: [ids], folders: [ids], target_folder? }
// All or nothing: if any item isn't yours (or is already in the Trash), nothing changes.
export const bulkAction = async (req, res) => {
    try {
        const { action } = req.body ?? {};
        const fileIds = Array.isArray(req.body?.files) ? [...new Set(req.body.files)] : [];
        const folderIds = Array.isArray(req.body?.folders) ? [...new Set(req.body.folders)] : [];

        if (!ACTIONS.includes(action)) return res.status(400).json({ error: "Unknown action." });
        if (!fileIds.length && !folderIds.length) return res.status(400).json({ error: "Select something first." });
        if (fileIds.length + folderIds.length > 500) return res.status(400).json({ error: "Select at most 500 items at once." });
        if (![...fileIds, ...folderIds].every(isUuid)) return res.status(404).json({ error: "Some items were not found." });

        const [files, folders] = await Promise.all([
            fileIds.length ? sql`SELECT id, folder_id FROM files WHERE owner_id = ${req.user.id} AND is_trashed = false AND id = ANY(${fileIds}::uuid[])` : [],
            folderIds.length ? sql`SELECT id, name, parent_id, path FROM folders WHERE owner_id = ${req.user.id} AND is_trashed = false AND id = ANY(${folderIds}::uuid[])` : [],
        ]);
        if (files.length !== fileIds.length || folders.length !== folderIds.length) {
            return res.status(404).json({ error: "Some items were not found or are already in the Trash." });
        }
        const count = files.length + folders.length;

        if (action === "star" || action === "unstar") {
            const starred = action === "star";
            await Promise.all([
                fileIds.length && sql`UPDATE files SET is_starred = ${starred} WHERE owner_id = ${req.user.id} AND id = ANY(${fileIds}::uuid[])`,
                folderIds.length && sql`UPDATE folders SET is_starred = ${starred} WHERE owner_id = ${req.user.id} AND id = ANY(${folderIds}::uuid[])`,
            ]);
            return res.status(200).json({ count });
        }

        if (action === "trash") {
            // Folders inside other selected folders go with their parent
            const selected = new Set(folderIds);
            const topFolders = folders.filter((f) => !(f.path || []).some((p) => selected.has(p)));
            for (const f of topFolders) await softDeleteFolderHierarchy(f.id, req.user.id);
            if (fileIds.length) {
                const trashed = await sql`
                UPDATE files SET is_trashed = true, trashed_at = NOW(), updated_at = NOW()
                WHERE owner_id = ${req.user.id} AND is_trashed = false AND id = ANY(${fileIds}::uuid[])
                RETURNING id`;
                await cleanupShareLinks(trashed.map((t) => t.id), []);
            }
            return res.status(200).json({ count });
        }

        // move
        const target = parseFolderRef(req.body?.target_folder);
        if (target === undefined) return res.status(404).json({ error: "Destination folder not found." });
        let targetPath = [];
        if (target) {
            const [dest] = await sql`SELECT id, path FROM folders WHERE id = ${target} AND owner_id = ${req.user.id} AND is_trashed = false`;
            if (!dest) return res.status(404).json({ error: "Destination folder not found." });
            if (folderIds.includes(dest.id) || (dest.path || []).some((p) => folderIds.includes(p))) {
                return res.status(400).json({ error: "A folder can't be moved into itself or one of its subfolders." });
            }
            targetPath = [...(dest.path || []), dest.id];
        }

        // Folder names must stay unique at the destination (among each other too)
        const moving = folders.filter((f) => (f.parent_id ?? null) !== target);
        const names = moving.map((f) => f.name.toLowerCase());
        if (new Set(names).size !== names.length) {
            return res.status(400).json({ error: "Two of the selected folders have the same name." });
        }
        if (moving.length) {
            const clash = await sql`
            SELECT name FROM folders
            WHERE owner_id = ${req.user.id} AND parent_id IS NOT DISTINCT FROM ${target} AND is_trashed = false
              AND lower(name) = ANY(${names}) AND NOT (id = ANY(${moving.map((f) => f.id)}::uuid[]))
            LIMIT 1`;
            if (clash.length) return res.status(400).json({ error: `A folder named "${clash[0].name}" already exists there.` });
        }

        for (const f of moving) {
            await sql`UPDATE folders SET parent_id = ${target}, path = ${targetPath}, updated_at = NOW() WHERE id = ${f.id} AND owner_id = ${req.user.id}`;
            await rebaseFolderPaths(f.id, targetPath, req.user.id);
        }
        if (fileIds.length) {
            await sql`UPDATE files SET folder_id = ${target}, updated_at = NOW() WHERE owner_id = ${req.user.id} AND id = ANY(${fileIds}::uuid[])`;
        }
        return res.status(200).json({ count });
    } catch (error) {
        return serverError(res, error);
    }
};
