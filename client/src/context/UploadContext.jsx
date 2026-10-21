import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "../config/api";
import { uploadFile } from "../lib/upload";
import { emitDriveChange } from "../lib/events";
import { useAuth } from "./AuthContext";

const UploadContext = createContext(null);
const CONCURRENCY = 3;
let nextId = 1;

// Upload queue: each file uploads on its own (straight to storage by default, see lib/upload.js)
// with real progress, three at a time.
// The panel in the corner reads this; views refresh as files land.
export const UploadProvider = ({ children }) => {
    const { updateUser } = useAuth();
    const [uploads, setUploads] = useState([]);
    const listRef = useRef([]); // source of truth, mirrored into state for rendering
    const files = useRef(new Map()); // id -> File
    const controllers = useRef(new Map()); // id -> AbortController
    const refreshTimer = useRef(null);

    const commit = useCallback((update) => {
        listRef.current = update(listRef.current);
        setUploads(listRef.current);
    }, []);

    const patch = useCallback((id, values) => {
        commit((list) => list.map((u) => (u.id === id ? { ...u, ...values } : u)));
    }, [commit]);

    // Refresh views at most every 600 ms while a batch lands
    const scheduleRefresh = useCallback(() => {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(emitDriveChange, 600);
    }, []);

    // Named so it can schedule itself again when an upload finishes
    const pump = useCallback(function startNext() {
        const running = listRef.current.filter((u) => u.status === "uploading").length;
        const starting = listRef.current.filter((u) => u.status === "queued").slice(0, Math.max(0, CONCURRENCY - running));
        if (!starting.length) return;

        const ids = new Set(starting.map((u) => u.id));
        commit((list) => list.map((u) => (ids.has(u.id) ? { ...u, status: "uploading" } : u)));

        starting.forEach((u) => {
            const controller = new AbortController();
            controllers.current.set(u.id, controller);

            uploadFile(files.current.get(u.id), u.folderId, {
                signal: controller.signal,
                onProgress: (fraction) => patch(u.id, { progress: Math.min(99, Math.round(fraction * 100)) }),
            })
                .then((data) => {
                    patch(u.id, { status: "done", progress: 100 });
                    if (data.storage_used !== undefined) updateUser({ storage_used: data.storage_used });
                    files.current.delete(u.id);
                    scheduleRefresh();
                })
                .catch((err) => {
                    if (controller.signal.aborted) patch(u.id, { status: "canceled" });
                    else patch(u.id, { status: "error", error: errorMessage(err, "Upload failed.") });
                })
                .finally(() => {
                    controllers.current.delete(u.id);
                    startNext();
                });
        });
    }, [commit, patch, scheduleRefresh, updateUser]);

    const uploadFiles = useCallback((fileList, folderId = null, folderName = "My Files") => {
        const picked = Array.from(fileList || []);
        if (!picked.length) return 0;
        const added = picked.map((file) => {
            const id = nextId++;
            files.current.set(id, file);
            return { id, name: file.name, size: file.size, type: file.type, folderId, folderName, progress: 0, status: "queued" };
        });
        commit((list) => [...list, ...added]);
        pump();
        return added.length;
    }, [commit, pump]);

    const cancel = useCallback((id) => {
        const controller = controllers.current.get(id);
        if (controller) controller.abort();
        else patch(id, { status: "canceled" });
    }, [patch]);

    const retry = useCallback((id) => {
        if (!files.current.has(id)) return;
        patch(id, { status: "queued", progress: 0, error: null });
        pump();
    }, [patch, pump]);

    // Removes finished, failed and canceled rows (active uploads keep going)
    const clearFinished = useCallback(() => {
        commit((list) => {
            const keep = list.filter((u) => u.status === "uploading" || u.status === "queued");
            list.forEach((u) => !keep.includes(u) && files.current.delete(u.id));
            return keep;
        });
    }, [commit]);

    const busy = uploads.some((u) => u.status === "uploading" || u.status === "queued");

    // Warn before closing the tab mid-upload
    useEffect(() => {
        if (!busy) return;
        const onBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [busy]);

    useEffect(() => () => clearTimeout(refreshTimer.current), []);

    const value = useMemo(() => ({ uploads, busy, uploadFiles, cancel, retry, clearFinished }), [uploads, busy, uploadFiles, cancel, retry, clearFinished]);

    return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
};

// eslint-disable-next-line react/only-export-components -- the hook lives next to its provider
export const useUploads = () => useContext(UploadContext);
