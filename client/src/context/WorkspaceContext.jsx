import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import api from "../config/api";
import { useDriveData } from "../hooks/useDriveData";
import { useUploads } from "./UploadContext";

const WorkspaceContext = createContext(null);
const ROOT = { id: null, name: "My Files" };

// Shared by the app shell: which folder you're in (uploads and "New folder" go there),
// the hidden file picker, and the storage stats shown in the sidebar.
export const WorkspaceProvider = ({ children }) => {
    const { uploadFiles } = useUploads();
    const [here, setHereState] = useState(ROOT);
    const inputRef = useRef(null);
    const stats = useDriveData(() => api.get("/api/drive/stats").then((r) => r.data), "stats");

    const setHere = useCallback((folder) => {
        setHereState((cur) => (cur.id === (folder?.id ?? null) && cur.name === (folder?.name ?? ROOT.name) ? cur : folder || ROOT));
    }, []);

    const pickFiles = useCallback(() => inputRef.current?.click(), []);

    const value = useMemo(() => ({ here, setHere, pickFiles, stats: stats.data, statsLoading: stats.loading }), [here, setHere, pickFiles, stats.data, stats.loading]);

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
            <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    uploadFiles(e.target.files, here.id, here.name);
                    e.target.value = "";
                }}
            />
        </WorkspaceContext.Provider>
    );
};

// eslint-disable-next-line react/only-export-components -- the hook lives next to its provider
export const useWorkspace = () => useContext(WorkspaceContext);
