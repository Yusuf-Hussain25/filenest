import { sql } from "../config/db.js"
import { deleteFromStorage, deleteMultipleFromStorage } from "../utils/s3Helper.js";

// Get all descendant folder IDs for a given folder including the root folder ID itself.
export const getFolderHierarchyIds = async (folderId, ownerId) => {
    const descendants = await sql`
     SELECT id FROM folders
     WHERE ${folderId} = ANY(path::text[]) AND owner_id = ${ownerId}`;
     return [folderId, ...descendants.map((f)=> f.id)]
}

// Adjust user storage quota
export const adjustUserStorage = async (userId, deltaBytes) => {
    const [user] = await sql`
    UPDATE users
    SET storage_used = GREATEST(0, storage_used + ${deltaBytes}), updated_at = NOW() WHERE id = ${userId} RETURNING storage_used
    `;

    return user ? Number(user.storage_used) : null;
}

// Remove share links associated with given resource IDs.
export const cleanupShareLinks = async (fileIds = [], folderIds = []) => {
    if (fileIds.length === 0 && folderIds.length === 0) return;

    const allIds = [...fileIds, ...folderIds];
    await sql`DELETE FROM share_links WHERE resource_id = ANY(${allIds}::uuid[])`
}

// Soft delete a folder and all its contents (recursive subfolders & files).
export const softDeleteFolderHierarchy = async (folderId, ownerId) => {
    const allFolderIds = await getFolderHierarchyIds(folderId, ownerId)
    const now = new Date();

    // Get all file IDs in hierarchy for share link cleanup
    const files = await sql`
    SELECT id FROM files
    WHERE folder_id = ANY(${allFolderIds}::uuid[]) AND owner_id = ${ownerId}
    AND is_trashed = false`;

    const fileIds = files.map((f)=> f.id)

    // Items trashed earlier keep their own trashed_at, so restoring this folder leaves them in the Trash
    await Promise.all([
        sql`
        UPDATE folders
        SET is_trashed = true, trashed_at = ${now}, updated_at = NOW()
        WHERE id = ANY(${allFolderIds}::uuid[]) AND owner_id = ${ownerId} AND is_trashed = false
        `,
        fileIds.length > 0 ? sql`
        UPDATE files
        SET is_trashed = true, trashed_at = ${now}, updated_at = NOW()
         WHERE id = ANY(${fileIds}::uuid[]) AND owner_id = ${ownerId}
        `
        : Promise.resolve(),
        cleanupShareLinks(fileIds, allFolderIds)
    ])
}

// Point every descendant of a folder at the folder's new location (newBasePath = the folder's own path).
export const rebaseFolderPaths = async (folderId, newBasePath, ownerId) => {
    await sql`
    UPDATE folders
    SET path = ${newBasePath}::uuid[] || ARRAY[${folderId}::uuid] || path[array_position(path, ${folderId}::uuid) + 1 : cardinality(path)],
        updated_at = NOW()
    WHERE owner_id = ${ownerId} AND ${folderId}::uuid = ANY(path)`;
}

// Restore a folder and everything that was trashed together with it. If its parent is gone or
// still in the Trash, the folder comes back at the top of My Files. Returns the new parent id.
export const restoreFolderHierarchy = async (folder, ownerId) => {
    const allFolderIds = await getFolderHierarchyIds(folder.id, ownerId)

    let parentId = folder.parent_id;
    if (parentId) {
        const [parent] = await sql`SELECT id FROM folders WHERE id = ${parentId} AND owner_id = ${ownerId} AND is_trashed = false`;
        if (!parent) {
            parentId = null;
            await sql`UPDATE folders SET parent_id = NULL, path = '{}'::uuid[] WHERE id = ${folder.id}`;
            await rebaseFolderPaths(folder.id, [], ownerId);
        }
    }

    await Promise.all([
        sql`
        UPDATE folders
        SET is_trashed = false, trashed_at = NULL, updated_at = NOW()
        WHERE id = ANY(${allFolderIds}::uuid[]) AND owner_id = ${ownerId}
          AND (id = ${folder.id} OR trashed_at = ${folder.trashed_at})
        `,
        sql`
        UPDATE files
        SET is_trashed = false, trashed_at = NULL, updated_at = NOW()
        WHERE folder_id = ANY(${allFolderIds}::uuid[]) AND owner_id = ${ownerId}
          AND trashed_at = ${folder.trashed_at}
        `
    ])

    return parentId;
}

// Permanently delete a folder and all its contents (recursive subfolders & files).
export const permanentDeleteFolderHierarchy = async (folderId, ownerId) => {
    const allFolderIds = await getFolderHierarchyIds(folderId, ownerId);

    const files = await sql`
    SELECT id, s3_key, size FROM files
    WHERE folder_id = ANY(${allFolderIds}::uuid[]) AND owner_id = ${ownerId}
    `;

    const s3Keys = files.map((f)=>f.s3_key);
    const fileIds = files.map((f)=>f.id);
    const totalFreedSize = files.reduce((acc, f)=> acc + Number(f.size), 0);

    await Promise.all([
        s3Keys.length > 0 ? deleteMultipleFromStorage(s3Keys) : Promise.resolve(),
        cleanupShareLinks(fileIds, allFolderIds),
        fileIds.length > 0 ? sql`DELETE FROM files WHERE id = ANY(${fileIds}::uuid[])` : Promise.resolve(),
        sql`DELETE FROM folders WHERE id = ANY(${allFolderIds}::uuid[])`
    ])

    if(totalFreedSize > 0){
        await adjustUserStorage(ownerId, -totalFreedSize);
    }
}

// Permanently delete a single file.
export const permanentDeleteFileRecord  = async (file, ownerId) => {
    await Promise.all([deleteFromStorage(file.s3_key), cleanupShareLinks([file.id], []), sql`DELETE FROM files WHERE id = ${file.id}`])
    await adjustUserStorage(ownerId, -Number(file.size))
}

// Permanently empty user's trash bin.
export const emptyTrashHierarchy = async (ownerId) => {
    const [trashedFiles, trashedFolders] = await Promise.all([
        sql`SELECT id, s3_key, size FROM files WHERE owner_id = ${ownerId} AND is_trashed = true`,
        sql`SELECT id FROM folders WHERE owner_id = ${ownerId} AND is_trashed = true`,
    ]);

    const s3Keys = trashedFiles.map((f)=> f.s3_key)
    const totalFreedBytes = trashedFiles.reduce((acc, f)=> acc + Number(f.size), 0);
    const trashedFileIds = trashedFiles.map((f)=>f.id)
    const trashedFolderIds = trashedFolders.map((f)=>f.id)

    await Promise.all([
        s3Keys.length > 0 ? deleteMultipleFromStorage(s3Keys) : Promise.resolve(),
        cleanupShareLinks(trashedFileIds, trashedFolderIds),
        sql`DELETE FROM files WHERE owner_id = ${ownerId} AND is_trashed = true`,
        sql`DELETE FROM folders WHERE owner_id = ${ownerId} AND is_trashed = true`,
    ]);

    if(totalFreedBytes > 0){
        await adjustUserStorage(ownerId, -totalFreedBytes)
    }
}