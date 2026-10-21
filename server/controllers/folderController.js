import { sql } from "../config/db.js";
import { permanentDeleteFolderHierarchy, rebaseFolderPaths, restoreFolderHierarchy, softDeleteFolderHierarchy } from "../services/storageService.js";
import { cleanName, parseFolderRef, serverError } from "../utils/http.js";

// Is there already a live folder with this name next to it?
const nameTaken = async (ownerId, parentId, name, exceptId = null) => {
    const [existing] = await sql`
    SELECT id FROM folders
    WHERE owner_id = ${ownerId} AND parent_id IS NOT DISTINCT FROM ${parentId}
      AND lower(name) = lower(${name}) AND is_trashed = false
      AND id IS DISTINCT FROM ${exceptId}`;
    return Boolean(existing);
};

// Create new folder
// POST  /api/folders
export const createFolder = async (req, res) => {
    try {
        const { name, error } = cleanName(req.body?.name, "Folder name");
        if(error){
            return res.status(400).json({ error })
        }

        const targetParent = parseFolderRef(req.body.parent_id ?? req.body.parent);
        if (targetParent === undefined) {
            return res.status(404).json({ error: "Parent folder not found." });
        }

        let folderPath = [];
        if(targetParent){
            const [parentFolder] = await sql`
            SELECT id, path FROM folders
            WHERE id = ${targetParent} AND owner_id = ${req.user.id} AND is_trashed = false`;

            if(!parentFolder){
                return res.status(404).json({ error: "Parent folder not found." });
            }
            folderPath = [...(parentFolder.path || []), parentFolder.id]
        }

        if(await nameTaken(req.user.id, targetParent, name)){
            return res.status(400).json({ error: "A folder with this name already exists here." });
        }

        const [folder] = await sql`
        INSERT INTO folders (name, parent_id, owner_id, path)
        VALUES (${name}, ${targetParent}, ${req.user.id}, ${folderPath}) RETURNING *`;

        return res.status(201).json({folder})

    } catch (error) {
        return serverError(res, error);
    }
}

// Get subfolders in a folder
// GET /api/folders
export const getFolders = async (req, res) => {
    try {
        const parentId = parseFolderRef(req.query.parent_id ?? req.query.parent);
        if (parentId === undefined) {
            return res.status(404).json({ error: "Folder not found." });
        }

        // With what each folder holds: direct files and subfolders, and the size of everything inside
        const folders = await sql`
        SELECT f.*,
            (SELECT COUNT(*)::int FROM files fi WHERE fi.folder_id = f.id AND fi.is_trashed = false) AS file_count,
            (SELECT COUNT(*)::int FROM folders c WHERE c.parent_id = f.id AND c.is_trashed = false) AS folder_count,
            (SELECT COALESCE(SUM(fi.size), 0)::bigint FROM files fi
              WHERE fi.is_trashed = false AND fi.owner_id = f.owner_id
                AND (fi.folder_id = f.id OR fi.folder_id IN (SELECT d.id FROM folders d WHERE d.path @> ARRAY[f.id] AND d.is_trashed = false))) AS total_size,
            EXISTS (SELECT 1 FROM share_links s WHERE s.resource_id = f.id AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS is_shared
        FROM folders f
        WHERE f.owner_id = ${req.user.id} AND f.parent_id IS NOT DISTINCT FROM ${parentId} AND f.is_trashed = false ORDER BY f.name ASC`;

        return res.status(200).json({ folders });
    } catch (error) {
        return serverError(res, error);
    }
}

// Get folder details & breadcrumb trail
// GET /api/folders/:id
export const getFolderDetails = async (req, res) => {
    try {
        const [folder] = await sql`
        SELECT f.*, EXISTS (
            SELECT 1 FROM share_links s WHERE s.resource_id = f.id AND (s.expires_at IS NULL OR s.expires_at > NOW())
        ) AS is_shared
        FROM folders f
        WHERE f.id = ${req.params.id} AND f.owner_id = ${req.user.id} AND f.is_trashed = false`;

        if(!folder){
            return res.status(404).json({ error: "Folder not found." });
        }

        // Fetch ancestor names in one query (path is UUID[])
        const ancestorIds = folder.path || []
        const ancestors = ancestorIds.length > 0 ? await sql`SELECT id, name FROM folders WHERE id = ANY(${ancestorIds}::uuid[]) AND owner_id = ${req.user.id}` : [];

        // Preserve path order
        const ancestorMap = new Map(ancestors.map((a)=>[a.id, a.name]))
        const breadcrumbs = [
            {id: null, name: "My Files"},
            ...ancestorIds.map((aid)=> ({id: aid, name: ancestorMap.get(aid) ?? ""})),
            {id: folder.id, name: folder.name}
        ];

        return res.status(200).json({ folder, breadcrumbs });
    } catch (error) {
        return serverError(res, error);
    }
}

// Rename folder
// PATCH /api/folders/:id/rename
export const renameFolder = async (req, res) => {
    try {
        const { name, error } = cleanName(req.body?.name, "Folder name");
        if(error){
            return res.status(400).json({ error })
        }

        const [current] = await sql`SELECT id, parent_id FROM folders WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = false`;
        if(!current){
            return res.status(404).json({ error: "Folder not found." });
        }

        if(await nameTaken(req.user.id, current.parent_id, name, current.id)){
            return res.status(400).json({ error: "A folder with this name already exists here." });
        }

        const [folder] = await sql`UPDATE folders SET name = ${name}, updated_at = NOW() WHERE id = ${current.id} AND owner_id = ${req.user.id} RETURNING *`;

        return res.status(200).json({ folder });

    } catch (error) {
        return serverError(res, error);
    }
}

// Move folder to another directory
// PATCH /api/folders/:id/move
export const moveFolder = async (req, res) => {
    try {
        const targetParent = parseFolderRef(req.body?.target_parent ?? req.body?.targetParent);
        const folderId = req.params.id;

        if (targetParent === undefined) {
            return res.status(404).json({ error: "Target folder not found." });
        }

        if (targetParent === folderId){
            return res.status(400).json({ error: "Cannot move folder into itself." });
        }

        const [folder] = await sql`
        SELECT * FROM folders
        WHERE id = ${folderId} AND owner_id = ${req.user.id} AND is_trashed = false`;

        if(!folder){
            return res.status(404).json({ error: "Folder not found." });
        }

        let newPath = [];
        if (targetParent) {
            const [targetFolder] = await sql`
            SELECT * FROM folders
            WHERE id = ${targetParent} AND owner_id = ${req.user.id} AND is_trashed = false`;

            if(!targetFolder){
                return res.status(404).json({ error: "Target folder not found." });
            }

            const targetPath = targetFolder.path || [];

            if(targetPath.includes(folderId)){
                return res.status(400).json({ error: "Cannot move folder into one of its subfolders." });
            }

            newPath = [...targetPath, targetFolder.id]
        }

        if(await nameTaken(req.user.id, targetParent, folder.name, folder.id)){
            return res.status(400).json({ error: "A folder with this name already exists there." });
        }

        // Update moved folder, then rebase every descendant's path onto the new location
        await sql`
        UPDATE folders
        SET parent_id = ${targetParent}, path = ${newPath}, updated_at = NOW()
        WHERE id = ${folderId} AND owner_id = ${req.user.id}`;
        await rebaseFolderPaths(folderId, newPath, req.user.id);

        const [updated] = await sql`SELECT * FROM folders WHERE id = ${folderId}`;
        return res.status(200).json({folder: updated })
    } catch (error) {
        return serverError(res, error);
    }
}

// Soft delete folder (move to Trash)
// DELETE /api/folders/:id
export const softDeleteFolder = async (req, res) => {
    try {
        const [folder] = await sql`SELECT id FROM folders
        WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = false`;

        if (!folder){
             return res.status(404).json({ error: "Folder not found." });
        }

        await softDeleteFolderHierarchy(folder.id, req.user.id)
        return res.status(200).json({message: "Folder moved to Trash."})
    } catch (error) {
        return serverError(res, error);
    }
}

// Restore folder from Trash
// POST /api/folders/:id/restore
export const restoreFolder = async (req, res) => {
    try {
        const [folder] = await sql`SELECT * FROM folders
        WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = true`;

        if (!folder){
             return res.status(404).json({ error: "Folder not found in Trash." });
        }

        const parentId = await restoreFolderHierarchy(folder, req.user.id)
        return res.status(200).json({message: "Folder restored.", parent_id: parentId})
    } catch (error) {
        return serverError(res, error);
    }
}

// Permanently delete folder and all nested contents
// DELETE /api/folders/:id/permanent
export const permanentDeleteFolder = async (req, res) => {
    try {
        const [folder] = await sql`SELECT id FROM folders
        WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = true`;

        if (!folder){
             return res.status(404).json({ error: "Folder not found in Trash." });
        }

        await permanentDeleteFolderHierarchy(folder.id, req.user.id)
        return res.status(200).json({message: "Folder permanently deleted."})
    } catch (error) {
        return serverError(res, error);
    }
}
