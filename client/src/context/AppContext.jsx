import { createContext, useCallback, useContext, useState } from "react";
import toast from "react-hot-toast";
import api from "../config/api";
import { useAuth } from "./AuthContext";

// 1.0 drive state, kept until the app shell is rebuilt. Auth now comes from AuthContext.
const AppContext = createContext()

const ROOT_BREADCRUMB = [{id: null, name: "My Files"}]
const getErrMsg = (err, fallback) => err.response?.data?.error || fallback;

export const AppProvider = ({children})=>{
    const auth = useAuth()
    const user = auth.user

    // Upload Global State
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Drive View State
    const [currentFolderId, setCurrentFolderId] = useState(null)
    const [breadcrumbs, setBreadcrumbs] = useState(ROOT_BREADCRUMB)
    const [folders, setFolders] = useState([])
    const [files, setFiles] = useState([]);
    const [isDriveLoading, setIsDriveLoading] = useState(false)

    // Filter & Sort State
    const [searchQuery, setSearchQuery] = useState("")
    const [sortBy, setSortBy] = useState("name_asc")

    const logout = async ()=>{
        try {
            await auth.logout()
            toast.success("Logged out")
        } catch (error) {
            toast.error(getErrMsg(error, "Logout error"));
        }
    }

    const fetchDriveContent = useCallback(
        async (folderId = currentFolderId, search = searchQuery, sort = sortBy)=>{
            if(!user) return;
            setIsDriveLoading(true)
            try {
                const parentParam = folderId || "null";
                const [folderRes, fileRes, detailRes] = await Promise.all([
                    api.get("/api/folders", {params: { parent_id: parentParam }}),
                    api.get("/api/files", {params: { folder_id: parentParam, search, sort }}),
                    folderId ? api.get(`/api/folders/${folderId}`) : null,
                ])

                setFolders(folderRes.data.folders);
                setFiles(fileRes.data.files);
                setBreadcrumbs(detailRes?.data?.breadcrumbs || ROOT_BREADCRUMB)
            } catch {
                toast.error("Error loading drive contents");
            }finally{
                setIsDriveLoading(false)
            }
        },
        [user, currentFolderId, searchQuery, sortBy]
    )

    const value = {
        user, logout,
        isLoading: auth.isLoading, isAuthenticated: auth.isAuthenticated,
        isUploading,
        setIsUploading,
        uploadProgress,
        setUploadProgress,
        refreshUser: auth.refreshUser,
        currentFolderId,
        setCurrentFolderId,
        breadcrumbs,
        folders,
        setFolders,
        files,
        setFiles,
        isDriveLoading,
        fetchDriveContent,
        searchQuery,
        setSearchQuery,
        sortBy,
        setSortBy,
    }

    return <AppContext.Provider value={value}>
        {children}
    </AppContext.Provider>
}

// eslint-disable-next-line react/only-export-components -- the hook lives next to its provider
export const useApp = ()=> useContext(AppContext);
