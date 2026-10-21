import axios from "axios";
import api from "../config/api";

// How files reach storage:
//   "direct" (default): the API hands out a presigned URL and the browser PUTs the file straight
//            to the bucket (needs bucket CORS, set by `npm run bucket`). No size cap from the API.
//   "server": the file goes through the API (multipart), capped at 100 MB, no CORS needed.
// If a direct upload can't reach the bucket at all, Filenest falls back to "server" for the session.
const configured = import.meta.env.VITE_UPLOAD_MODE === "server" ? "server" : "direct";
let mode = configured;

// Plain client for storage: no API base URL, no cookies
const storage = axios.create();

const viaServer = async (file, folderId, { signal, onProgress }) => {
    const form = new FormData();
    form.append("files", file, file.name);
    if (folderId) form.append("folder_id", folderId);
    const { data } = await api.post("/api/files/upload", form, {
        signal,
        onUploadProgress: (e) => e.total && onProgress(e.loaded / e.total),
    });
    return { file: data.files[0], storage_used: data.storage_used };
};

const direct = async (file, folderId, { signal, onProgress }) => {
    const { data: ticket } = await api.post("/api/files/uploads", {
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        folder_id: folderId,
    }, { signal });

    try {
        await storage.put(ticket.url, file, {
            headers: ticket.headers,
            signal,
            onUploadProgress: (e) => e.total && onProgress(e.loaded / e.total),
        });
    } catch (err) {
        // Free the reservation; the caller decides whether to fall back
        api.delete(`/api/files/uploads/${ticket.upload_id}`).catch(() => {});
        throw err;
    }

    const { data } = await api.post(`/api/files/uploads/${ticket.upload_id}/complete`, null, { signal });
    return data;
};

// Uploads one file and resolves with { file, storage_used }
export const uploadFile = async (file, folderId, { signal, onProgress = () => {} } = {}) => {
    if (mode === "server") return viaServer(file, folderId, { signal, onProgress });
    try {
        return await direct(file, folderId, { signal, onProgress });
    } catch (err) {
        // A network error on the storage PUT usually means the bucket has no CORS rule yet
        const unreachable = err.code === "ERR_NETWORK" && !err.response && !signal?.aborted && !err.config?.baseURL;
        if (!unreachable || file.size > 104857600) throw err;
        console.warn("[Filenest] Direct upload to storage failed, using uploads through the API. Run `npm run bucket` to set bucket CORS.");
        mode = "server";
        onProgress(0);
        return viaServer(file, folderId, { signal, onProgress });
    }
};
