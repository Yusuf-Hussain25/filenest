import { sql } from "../config/db.js";
import crypto from 'crypto'
import { getSignedFileUrl } from "../utils/s3Helper.js";
import { isUuid, serverError } from "../utils/http.js";

const PERMISSIONS = ["view", "download"];
const TOKEN_RE = /^[a-f0-9]{32}$/;
const MAX_EXPIRY_MS = 366 * 24 * 60 * 60 * 1000;

// What a visitor with the link may see about a file: no owner ids or storage keys
const sharedFileFields = (f) => ({
    id: f.id, name: f.name, mime_type: f.mime_type, size: f.size, created_at: f.created_at, updated_at: f.updated_at,
});

// Preview URL for everyone, plus a download URL when the link allows downloads
const withUrls = async (file, permission) => ({
    ...sharedFileFields(file),
    url: await getSignedFileUrl(file.s3_key, { filename: file.name }),
    download_url: permission === "download" ? await getSignedFileUrl(file.s3_key, { download: true, filename: file.name }) : null,
});

// Validates an optional expiry: null for "never", a Date, or an error message
const parseExpiry = (value) => {
    if (value === undefined || value === null || value === "") return { expiresAt: null };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { error: "Invalid expiry date." };
    if (date.getTime() <= Date.now()) return { error: "Expiry must be in the future." };
    if (date.getTime() - Date.now() > MAX_EXPIRY_MS) return { error: "Links can expire at most one year from now." };
    return { expiresAt: date };
};

// Create or retrieve public share link for file or folder
// POST /api/shares
export const createShareLink = async (req, res) => {
    try {
        const resourceType = req.body?.resource_type ?? req.body?.resourceType;
        const resourceId = req.body?.resource_id ?? req.body?.resourceId;
        const permission = req.body?.permission ?? "download";

        if (!["file", "folder"].includes(resourceType)){
            return res.status(400).json({ error: "Resource type must be file or folder." });
        }
        if (!isUuid(resourceId)) {
            return res.status(404).json({ error: `${resourceType === "file" ? "File" : "Folder"} not found.` });
        }
        if (!PERMISSIONS.includes(permission)) {
            return res.status(400).json({ error: "Permission must be view or download." });
        }
        const { expiresAt, error } = parseExpiry(req.body?.expires_at ?? req.body?.expiresAt);
        if (error) {
            return res.status(400).json({ error });
        }

        // Verify resource exists and belongs to user
        const [resource] =
            resourceType === "file"
            ? await sql`
            SELECT id FROM files
            WHERE id = ${resourceId} AND owner_id = ${req.user.id} AND is_trashed = false`
            :
            await sql`
            SELECT id FROM folders
            WHERE id = ${resourceId} AND owner_id = ${req.user.id} AND is_trashed = false
            `;

        if(!resource){
            return res.status(404).json({ error: `${resourceType === "file" ? "File" : "Folder"} not found.` });
        }

        // Check for an existing share link for this resource
        const [existing] = await sql`
        SELECT * FROM share_links
        WHERE resource_type = ${resourceType}
          AND resource_id = ${resource.id}
          AND owner_id = ${req.user.id}`;

        // If expired, remove it
        if(existing && existing.expires_at && new Date() > new Date(existing.expires_at)){
            await sql`DELETE FROM share_links WHERE id = ${existing.id}`;
        }else if(existing){
            return res.status(200).json({ share_link: existing, is_existing: true });
        }

        const token = crypto.randomBytes(16).toString("hex");
        const [shareLink] = await sql`
        INSERT INTO share_links (token, resource_type, resource_id, owner_id, permission, expires_at)
        VALUES (${token}, ${resourceType}, ${resource.id}, ${req.user.id}, ${permission}, ${expiresAt})
        RETURNING *
        `;

        return res.status(201).json({ share_link: shareLink, is_existing: false });

    } catch (error) {
        return serverError(res, error);
    }
}

// Get user's share links with single-query resource resolution
// GET /api/shares
export const getUserShareLinks = async (req, res) => {
    try {
        const activeShareLinks = await sql`
        SELECT sl.*,
            CASE
                WHEN sl.resource_type = 'file' THEN json_build_object('id', f.id, 'name', f.name, 'mime_type', f.mime_type, 'size', f.size)
                WHEN sl.resource_type = 'folder' THEN json_build_object('id', fo.id, 'name', fo.name)
              END AS resource
          FROM share_links sl
          LEFT JOIN files f ON sl.resource_type = 'file' AND f.id = sl.resource_id AND f.is_trashed = false
        LEFT JOIN folders pf ON f.folder_id = pf.id
        LEFT JOIN folders fo ON sl.resource_type = 'folder' AND fo.id = sl.resource_id AND fo.is_trashed = false
        WHERE sl.owner_id = ${req.user.id}
        AND (
            (sl.resource_type = 'file' AND f.id IS NOT NULL AND (f.folder_id IS NULL OR pf.is_trashed = false))
            OR
            (sl.resource_type = 'folder' AND fo.id IS NOT NULL)
        )
        ORDER BY sl.created_at DESC
        `;

        return res.status(200).json({ share_links: activeShareLinks });
    } catch (error) {
        return serverError(res, error);
    }
}

// Access shared item by token (public link for anyone).
// For a shared folder, ?folder=<id> opens one of its subfolders.
// GET /api/shares/access/:token
export const accessShareLink = async (req, res) => {
    try {
        const { token } = req.params;
        if (!TOKEN_RE.test(token)) {
            return res.status(404).json({ error: "Share link not found or has been revoked." });
        }

        const [shareLink] = await sql`SELECT * FROM share_links WHERE token = ${token}`;

        if (!shareLink){
            return res.status(404).json({ error: "Share link not found or has been revoked." });
        }

        // Check expiration
        if(shareLink.expires_at && new Date() > new Date(shareLink.expires_at)){
            return res.status(410).json({ error: "This share link has expired." });
        }

        const subfolderId = req.query.folder;
        if (subfolderId !== undefined && (shareLink.resource_type !== "folder" || !isUuid(subfolderId))) {
            return res.status(404).json({ error: "Folder not found in this share." });
        }

        // Count opens of the link itself, not every click inside a shared folder
        if (!subfolderId) {
            await sql`UPDATE share_links SET access_count = access_count + 1 WHERE id = ${shareLink.id}`;
        }

        const [owner] = await sql`SELECT name FROM users WHERE id = ${shareLink.owner_id}`;
        const meta = {
            permission: shareLink.permission,
            expires_at: shareLink.expires_at,
            owner: { name: owner?.name ?? "A Filenest user" },
        };

        if (shareLink.resource_type === "file"){
            const [file] = await sql`SELECT * FROM files WHERE id = ${shareLink.resource_id} AND owner_id = ${shareLink.owner_id}`;
            if(!file || file.is_trashed){
                return res.status(404).json({ error: "File is no longer available." });
            }

            if(file.folder_id){
                const [parentFolder] = await sql`SELECT is_trashed FROM folders WHERE id = ${file.folder_id}`
                if(!parentFolder || parentFolder.is_trashed){
                    return res.status(404).json({ error: "File is no longer available." });
                }
            }

            return res.status(200).json({
                resource_type: "file",
                file: await withUrls(file, shareLink.permission),
                ...meta,
            })
        }

        // Folder resource
        const [root] = await sql`SELECT id, name, path, is_trashed, created_at FROM folders WHERE id = ${shareLink.resource_id} AND owner_id = ${shareLink.owner_id}`;
        if (!root || root.is_trashed){
            return res.status(404).json({ error: "Folder is no longer available." });
        }

        // A subfolder must live inside the shared folder
        let folder = root;
        if (subfolderId && subfolderId !== root.id) {
            const [sub] = await sql`
            SELECT id, name, path, is_trashed, created_at FROM folders
            WHERE id = ${subfolderId} AND owner_id = ${shareLink.owner_id} AND ${root.id}::uuid = ANY(path)`;
            if (!sub || sub.is_trashed) {
                return res.status(404).json({ error: "Folder not found in this share." });
            }
            folder = sub;
        }

        // Breadcrumbs from the shared folder down to the open one
        const inside = folder.id === root.id ? [] : [...folder.path.slice(folder.path.indexOf(root.id) + 1), folder.id];
        const names = inside.length ? await sql`SELECT id, name FROM folders WHERE id = ANY(${inside}::uuid[])` : [];
        const nameOf = new Map(names.map((n) => [n.id, n.name]));
        const breadcrumbs = [{ id: root.id, name: root.name }, ...inside.map((id) => ({ id, name: nameOf.get(id) ?? "" }))];

        const [subfolders, files] = await Promise.all([
            sql`SELECT id, name, created_at FROM folders WHERE parent_id = ${folder.id} AND is_trashed = false ORDER BY name ASC`,
            sql`SELECT * FROM files WHERE folder_id = ${folder.id} AND is_trashed = false ORDER BY name ASC`,
        ]);

        return res.status(200).json({
            resource_type: "folder",
            folder: { id: folder.id, name: folder.name, created_at: folder.created_at },
            root: { id: root.id, name: root.name },
            breadcrumbs,
            subfolders,
            files: await Promise.all(files.map((f) => withUrls(f, shareLink.permission))),
            ...meta,
        })
    } catch (error) {
        return serverError(res, error);
    }
}

// Change who can download and when a link expires
// PATCH /api/shares/:id   { permission?, expires_at? (null = never) }
export const updateShareLink = async (req, res) => {
    try {
        const [link] = await sql`SELECT * FROM share_links WHERE id = ${req.params.id} AND owner_id = ${req.user.id}`;
        if (!link) {
            return res.status(404).json({ error: "Share link not found." });
        }

        const permission = req.body?.permission ?? link.permission;
        if (!PERMISSIONS.includes(permission)) {
            return res.status(400).json({ error: "Permission must be view or download." });
        }

        let expiresAt = link.expires_at;
        if (req.body && "expires_at" in req.body) {
            const parsed = parseExpiry(req.body.expires_at);
            if (parsed.error) {
                return res.status(400).json({ error: parsed.error });
            }
            expiresAt = parsed.expiresAt;
        }

        const [updated] = await sql`
        UPDATE share_links SET permission = ${permission}, expires_at = ${expiresAt}, updated_at = NOW()
        WHERE id = ${link.id} AND owner_id = ${req.user.id}
        RETURNING *`;
        return res.status(200).json({ share_link: updated });
    } catch (error) {
        return serverError(res, error);
    }
}

// Revoke/delete share link
// DELETE /api/shares/:id
export const deleteShareLink = async (req, res) => {
    try {
        const [shareLink] = await sql`
        DELETE FROM share_links
        WHERE id = ${req.params.id} AND owner_id = ${req.user.id}
        RETURNING id`;

        if (!shareLink){
            return res.status(404).json({ error: "Share link not found." });
        }

        return res.status(200).json({ message: "Share link revoked." });
    } catch (error) {
        return serverError(res, error);
    }
}
