import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import api from "../config/api";
import { useDriveData } from "../hooks/useDriveData";
import { useUploads } from "./UploadContext";
import { entriesFromInput } from "../lib/folderEntries";

const WorkspaceContext = createContext(null);
const ROOT = { id: null, name: "My Files" };

// Shared by the app shell: which folder you're in (uploads and "New folder" go there),
// the hidden file picker, and the storage stats shown in the sidebar.
export const WorkspaceProvider = ({ children }) => {
    const { uploadFiles, uploadTree } = useUploads();
    const [here, setHereState] = useState(ROOT);
    const inputRef = useRef(null);
    const folderInputRef = useRef(null);
    const stats = useDriveData(() => api.get("/api/drive/stats").then((r) => r.data), "stats");

    const setHere = useCallback((folder) => {
        setHereState((cur) => (cur.id === (folder?.id ?? null) && cur.name === (folder?.name ?? ROOT.name) ? cur : folder || ROOT));
    }, []);

    const pickFiles = useCallback(() => inputRef.current?.click(), []);
    const pickFolder = useCallback(() => folderInputRef.current?.click(), []);

    const value = useMemo(() => ({ here, setHere, pickFiles, pickFolder, stats: stats.data, statsLoading: stats.loading }), [here, setHere, pickFiles, pickFolder, stats.data, stats.loading]);

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
            <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                multiple
                hidden
                onChange={(e) => {
                    uploadTree(entriesFromInput(e.target.files), here.id, here.name);
                    e.target.value = "";
                }}
            />
        </WorkspaceContext.Provider>
    );
};

// eslint-disable-next-line react/only-export-components -- the hook lives next to its provider
export const useWorkspace = () => useContext(WorkspaceContext);
