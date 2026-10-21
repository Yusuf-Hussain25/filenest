import { once } from "events";
import path from "path";
import { ZipArchive } from "archiver";
import { sql } from "../config/db.js";
import { getObjectStream } from "../utils/s3Helper.js";

// Biggest download we'll zip up in one go
export const ZIP_MAX_BYTES = Number(process.env.ZIP_MAX_BYTES || 2147483648); // 2 GB

const zipSafe = (name) => name.replace(/[/\\:*?"<>|\u0000-\u001f]/g, "_").trim() || "untitled";

// Everything (not trashed) inside the given folders, with paths relative to each folder's parent:
// [{ s3_key, size, path: "Trip/Day 1/a.jpg" }] and the folder paths ("Trip/Day 1/") to keep empty ones.
export const collectFolders = async (folderIds, ownerId) => {
    if (!folderIds.length) return { files: [], dirs: [] };
    const folders = await sql`
    SELECT id, name, parent_id FROM folders
    WHERE owner_id = ${ownerId} AND is_trashed = false
      AND (id = ANY(${folderIds}::uuid[]) OR path && ${folderIds}::uuid[])`;
    const byId = new Map(folders.map((f) => [f.id, f]));
    const roots = new Set(folderIds);

    // "Trip/Day 1" for a folder, walking up to the selected folder it lives in
    const dirPath = (id) => {
        const parts = [];
        let f = byId.get(id);
        while (f) {
            parts.unshift(zipSafe(f.name));
            if (roots.has(f.id)) break;
            f = byId.get(f.parent_id);
        }
        return parts.join("/");
    };

    const live = folders.filter((f) => {
        // A folder only counts if its whole chain up to a selected folder is live
        let f2 = f;
        while (f2 && !roots.has(f2.id)) f2 = byId.get(f2.parent_id);
        return Boolean(f2);
    });
    const liveIds = live.map((f) => f.id);
    const files = liveIds.length ? await sql`
    SELECT s3_key, size, name, folder_id FROM files
    WHERE owner_id = ${ownerId} AND is_trashed = false AND folder_id = ANY(${liveIds}::uuid[])
    ORDER BY name` : [];

    return {
        files: files.map((f) => ({ s3_key: f.s3_key, size: Number(f.size), path: `${dirPath(f.folder_id)}/${zipSafe(f.name)}` })),
        dirs: live.map((f) => `${dirPath(f.id)}/`),
    };
};

// Streams a ZIP to the response. Entries: [{ s3_key, size, path }]. Files with the same path get
// " (2)" etc., and storage objects are opened one at a time.
export const streamZip = async (res, zipName, entries, dirs = []) => {
    const seen = new Set();
    const unique = (p) => {
        if (!seen.has(p.toLowerCase())) {
            seen.add(p.toLowerCase());
            return p;
        }
        const { dir, name, ext } = path.posix.parse(p);
        for (let i = 2; ; i++) {
            const next = `${dir ? `${dir}/` : ""}${name} (${i})${ext}`;
            if (!seen.has(next.toLowerCase())) {
                seen.add(next.toLowerCase());
                return next;
            }
        }
    };

    const fallback = zipName.replace(/[^\x20-\x7e]|["\\]/g, "_");
    res.status(200);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(zipName)}`);
    res.setHeader("Cache-Control", "no-store");

    // Photos and videos are already compressed; a light level keeps it fast
    const archive = new ZipArchive({ zlib: { level: 3 } });
    archive.on("warning", (err) => console.warn("[ZIP]", err.message));
    archive.on("error", (err) => {
        console.error("[ZIP]", err);
        res.destroy(err);
    });
    archive.pipe(res);

    let aborted = false;
    res.on("close", () => {
        if (!res.writableFinished) {
            aborted = true;
            archive.abort();
        }
    });

    for (const dir of dirs) archive.append("", { name: dir });
    for (const entry of entries) {
        if (aborted) return;
        const body = await getObjectStream(entry.s3_key);
        const done = once(archive, "entry");
        archive.append(body, { name: unique(entry.path) });
        await done;
    }
    await archive.finalize();
};

// Download name: "Goa 2026.zip", or "Filenest 2026-10-21.zip" for a mixed selection
export const zipNameFor = (label) => `${zipSafe(label)}.zip`;
