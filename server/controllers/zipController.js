import { sql } from "../config/db.js";
import { isUuid, serverError } from "../utils/http.js";
import { collectFolders, streamZip, ZIP_MAX_BYTES, zipNameFor } from "../services/zipService.js";

// Shared by every ZIP route: with ?check=1 answer with what would be zipped (so the app can show
// a message instead of navigating to an error), otherwise stream the archive.
const respond = async (req, res, label, files, dirs) => {
    const size = files.reduce((n, f) => n + f.size, 0);
    if (size > ZIP_MAX_BYTES) {
        return res.status(413).json({ error: `That's ${Math.round(size / 1048576)} MB; ZIP downloads are limited to ${Math.round(ZIP_MAX_BYTES / 1048576)} MB.` });
    }
    if (!files.length && !dirs.length) {
        return res.status(400).json({ error: "There's nothing to download here yet." });
    }
    if (req.query.check === "1") {
        return res.status(200).json({ files: files.length, size, name: zipNameFor(label) });
    }
    return streamZip(res, zipNameFor(label), files, dirs);
};

const today = () => new Date().toISOString().slice(0, 10);

// A folder and everything in it
// GET /api/folders/:id/zip
export const folderZip = async (req, res) => {
    try {
        const [folder] = await sql`SELECT id, name FROM folders WHERE id = ${req.params.id} AND owner_id = ${req.user.id} AND is_trashed = false`;
        if (!folder) return res.status(404).json({ error: "Folder not found." });
        const { files, dirs } = await collectFolders([folder.id], req.user.id);
        return await respond(req, res, folder.name, files, dirs);
    } catch (error) {
        if (res.headersSent) return res.destroy(error);
        return serverError(res, error);
    }
};

// Any mix of your files and folders
// GET /api/drive/zip?files=<id,id>&folders=<id,id>
export const selectionZip = async (req, res) => {
    try {
        const list = (v) => (typeof v === "string" && v ? v.split(",") : []);
        const fileIds = list(req.query.files);
        const folderIds = list(req.query.folders);
        if (!fileIds.length && !folderIds.length) return res.status(400).json({ error: "Choose something to download." });
        if (fileIds.length + folderIds.length > 500) return res.status(400).json({ error: "Download at most 500 items at once." });
        if (![...fileIds, ...folderIds].every(isUuid)) return res.status(404).json({ error: "Some items were not found." });

        const [files, folders] = await Promise.all([
            fileIds.length ? sql`SELECT s3_key, size, name FROM files WHERE owner_id = ${req.user.id} AND is_trashed = false AND id = ANY(${fileIds}::uuid[])` : [],
            folderIds.length ? sql`SELECT id, name FROM folders WHERE owner_id = ${req.user.id} AND is_trashed = false AND id = ANY(${folderIds}::uuid[])` : [],
        ]);
        if (files.length + folders.length !== fileIds.length + folderIds.length) {
            return res.status(404).json({ error: "Some items were not found." });
        }

        const inside = await collectFolders(folders.map((f) => f.id), req.user.id);
        const entries = [...files.map((f) => ({ s3_key: f.s3_key, size: Number(f.size), path: f.name.replace(/[/\\]/g, "_") })), ...inside.files];
        const label = !files.length && folders.length === 1 ? folders[0].name : `Filenest ${today()}`;
        return await respond(req, res, label, entries, inside.dirs);
    } catch (error) {
        if (res.headersSent) return res.destroy(error);
        return serverError(res, error);
    }
};

// A shared folder (or one of its subfolders), only when the link allows downloads
// GET /api/shares/access/:token/zip?folder=<id>
export const shareZip = async (req, res) => {
    try {
        const { token } = req.params;
        if (!/^[a-f0-9]{32}$/.test(token)) return res.status(404).json({ error: "Share link not found or has been revoked." });
        const [link] = await sql`SELECT * FROM share_links WHERE token = ${token}`;
        if (!link) return res.status(404).json({ error: "Share link not found or has been revoked." });
        if (link.expires_at && new Date() > new Date(link.expires_at)) return res.status(410).json({ error: "This share link has expired." });
        if (link.resource_type !== "folder") return res.status(400).json({ error: "Only shared folders can be downloaded as a ZIP." });
        if (link.permission !== "download") return res.status(403).json({ error: "This link is view only." });

        const target = req.query.folder || link.resource_id;
        if (!isUuid(target)) return res.status(404).json({ error: "Folder not found in this share." });
        const [folder] = await sql`
        SELECT id, name FROM folders
        WHERE id = ${target} AND owner_id = ${link.owner_id} AND is_trashed = false
          AND (id = ${link.resource_id} OR ${link.resource_id}::uuid = ANY(path))`;
        if (!folder) return res.status(404).json({ error: "Folder not found in this share." });

        const { files, dirs } = await collectFolders([folder.id], link.owner_id);
        return await respond(req, res, folder.name, files, dirs);
    } catch (error) {
        if (res.headersSent) return res.destroy(error);
        return serverError(res, error);
    }
};
