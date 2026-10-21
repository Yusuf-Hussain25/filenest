// Turns dropped or picked files and folders into [{ file, path }] plus the folder paths to create,
// so a folder upload keeps its structure ("Trip/Day 1/beach.jpg").

const JUNK = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);

const readAllEntries = (reader) =>
    new Promise((resolve, reject) => {
        const all = [];
        // readEntries returns batches (about 100 at a time) until it returns an empty one
        const next = () => reader.readEntries((batch) => {
            if (!batch.length) resolve(all);
            else {
                all.push(...batch);
                next();
            }
        }, reject);
        next();
    });

const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject));

const walk = async (entry, prefix, out) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isFile) {
        if (!JUNK.has(entry.name)) out.files.push({ file: await fileOf(entry), path });
    } else if (entry.isDirectory) {
        out.dirs.add(path);
        for (const child of await readAllEntries(entry.createReader())) await walk(child, path, out);
    }
};

// From a drop event. Must be called during the event: the entries are only readable then.
export const entriesFromDrop = (dataTransfer) => {
    const roots = [...(dataTransfer.items || [])]
        .filter((item) => item.kind === "file")
        .map((item) => item.webkitGetAsEntry?.())
        .filter(Boolean);
    // Browsers without the entries API: plain files only
    if (!roots.length) {
        return Promise.resolve({ files: [...dataTransfer.files].map((file) => ({ file, path: file.name })), dirs: [] });
    }
    return (async () => {
        const out = { files: [], dirs: new Set() };
        for (const root of roots) await walk(root, "", out);
        return { files: out.files, dirs: [...out.dirs] };
    })();
};

// From <input type="file" webkitdirectory> (each file knows its relative path)
export const entriesFromInput = (fileList) => {
    const files = [];
    const dirs = new Set();
    for (const file of fileList) {
        if (JUNK.has(file.name)) continue;
        const path = file.webkitRelativePath || file.name;
        files.push({ file, path });
        const parts = path.split("/").slice(0, -1);
        parts.forEach((_, i) => dirs.add(parts.slice(0, i + 1).join("/")));
    }
    return { files, dirs: [...dirs] };
};

export const dirOf = (path) => path.split("/").slice(0, -1).join("/");
