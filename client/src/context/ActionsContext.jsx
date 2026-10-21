import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { DownloadIcon, EyeIcon, FolderInputIcon, FolderOpenIcon, FolderPlusIcon, Link2Icon, PencilIcon, StarIcon, StarOffIcon, Trash2Icon } from "lucide-react";
import api, { errorMessage } from "../config/api";
import { emitDriveChange } from "../lib/events";
import { isFolder } from "../lib/files";
import { downloadZip, saveFrom } from "../lib/download";
import { useAuth } from "./AuthContext";
import NameModal from "../components/drive/NameModal";
import MoveModal from "../components/drive/MoveModal";
import ShareModal from "../components/drive/ShareModal";
import FilePreview from "../components/preview/FilePreview";

const ActionsContext = createContext(null);

const endpoint = (item) => (isFolder(item) ? "folders" : "files");
const label = (item) => (isFolder(item) ? "Folder" : "File");

// Everything you can do to a file or folder, with toasts, undo and the dialogs it needs.
// Views call useActions() and build their menus with menuFor(item).
export const ActionsProvider = ({ children }) => {
    const navigate = useNavigate();
    const { refreshUser } = useAuth();
    const [dialog, setDialog] = useState(null); // { type, item, ... }
    // The viewer is its own layer, so share / rename / move dialogs can open on top of it
    const [preview, setPreview] = useState(null); // { item, list }
    const close = useCallback(() => setDialog(null), []);

    const changed = useCallback(() => {
        emitDriveChange();
    }, []);

    const open = useCallback((item, list = []) => {
        if (isFolder(item)) navigate(`/folder/${item.id}`);
        else setPreview({ item, list: list.filter((i) => !isFolder(i)) });
    }, [navigate]);

    const newFolder = useCallback((parentId = null, parentName = "My Files") => {
        setDialog({ type: "new-folder", parentId, parentName });
    }, []);

    const createFolder = useCallback(async (name, parentId) => {
        try {
            await api.post("/api/folders", { name, parent_id: parentId });
            toast.success(`Created "${name}"`);
            changed();
        } catch (err) {
            throw new Error(errorMessage(err, "Could not create the folder."));
        }
    }, [changed]);

    const renameItem = useCallback(async (item, name) => {
        try {
            await api.patch(`/api/${endpoint(item)}/${item.id}/rename`, { name });
            toast.success(`Renamed to "${name}"`);
            changed();
        } catch (err) {
            throw new Error(errorMessage(err, "Could not rename it."));
        }
    }, [changed]);

    // Many files and folders in one request: { action, files, folders, ...extra }
    const bulk = useCallback((action, items, extra = {}) => api.post("/api/drive/bulk", {
        action,
        files: items.filter((i) => !isFolder(i)).map((i) => i.id),
        folders: items.filter(isFolder).map((i) => i.id),
        ...extra,
    }), []);

    const moveItems = useCallback(async (items, targetId) => {
        try {
            if (items.length === 1) {
                const [item] = items;
                const body = isFolder(item) ? { target_parent: targetId } : { target_folder: targetId };
                await api.patch(`/api/${endpoint(item)}/${item.id}/move`, body);
            } else {
                await bulk("move", items, { target_folder: targetId });
            }
            toast.success(items.length === 1 ? `Moved "${items[0].name}"` : `Moved ${items.length} items`);
            changed();
            return true;
        } catch (err) {
            toast.error(errorMessage(err, "Could not move it."));
            return false;
        }
    }, [bulk, changed]);

    const toggleStar = useCallback(async (item) => {
        const starred = !item.is_starred;
        try {
            await api.patch(`/api/${endpoint(item)}/${item.id}/star`, { starred });
            toast.success(starred ? "Added to Starred" : "Removed from Starred");
            changed();
        } catch (err) {
            toast.error(errorMessage(err, "Could not update Starred."));
        }
    }, [changed]);

    const restore = useCallback(async (item, { quiet = false } = {}) => {
        try {
            await api.post(`/api/${endpoint(item)}/${item.id}/restore`);
            if (!quiet) toast.success(`Restored "${item.name}"`);
            changed();
            refreshUser();
            return true;
        } catch (err) {
            toast.error(errorMessage(err, "Could not restore it."));
            return false;
        }
    }, [changed, refreshUser]);

    const trash = useCallback(async (item) => {
        try {
            await api.delete(`/api/${endpoint(item)}/${item.id}`);
            changed();
            toast((t) => (
                <span className="flex items-center gap-3">
                    <span className="min-w-0 truncate">Moved "{item.name}" to Trash</span>
                    <button
                        className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-accent-text hover:bg-surface-2"
                        onClick={() => {
                            toast.dismiss(t.id);
                            restore(item, { quiet: true }).then((ok) => ok && toast.success("Restored"));
                        }}
                    >
                        Undo
                    </button>
                </span>
            ), { duration: 6000, icon: "🗑️" });
        } catch (err) {
            toast.error(errorMessage(err, `Could not move the ${label(item).toLowerCase()} to Trash.`));
        }
    }, [changed, restore]);

    // Files download from storage directly; folders come as a ZIP streamed by the API
    const download = useCallback(async (item) => {
        if (isFolder(item)) return downloadZip(`/api/folders/${item.id}/zip`);
        try {
            const { data } = await api.get(`/api/files/${item.id}/preview`, { params: { download: 1 } });
            // The signed URL answers with Content-Disposition: attachment, so this saves the file
            saveFrom(data.url);
        } catch (err) {
            toast.error(errorMessage(err, "Could not download the file."));
        }
    }, []);

    // Multi-select actions. Each resolves true when it worked, so the selection can be cleared.
    const starMany = useCallback(async (items, starred) => {
        try {
            await bulk(starred ? "star" : "unstar", items);
            toast.success(starred ? `Starred ${items.length} items` : `Removed ${items.length} items from Starred`);
            changed();
            return true;
        } catch (err) {
            toast.error(errorMessage(err, "Could not update Starred."));
            return false;
        }
    }, [bulk, changed]);

    const trashMany = useCallback(async (items) => {
        try {
            await bulk("trash", items);
            changed();
            refreshUser();
            toast((t) => (
                <span className="flex items-center gap-3">
                    <span>Moved {items.length} items to Trash</span>
                    <button
                        className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-accent-text hover:bg-surface-2"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const results = await Promise.all(items.map((i) => restore(i, { quiet: true })));
                            if (results.every(Boolean)) toast.success(`Restored ${items.length} items`);
                        }}
                    >
                        Undo
                    </button>
                </span>
            ), { duration: 6000, icon: "🗑️" });
            return true;
        } catch (err) {
            toast.error(errorMessage(err, "Could not move them to Trash."));
            return false;
        }
    }, [bulk, changed, refreshUser, restore]);

    // One file downloads as itself; anything more comes as one ZIP
    const downloadMany = useCallback((items) => {
        if (items.length === 1) return download(items[0]);
        const files = items.filter((i) => !isFolder(i)).map((i) => i.id);
        const folders = items.filter(isFolder).map((i) => i.id);
        return downloadZip("/api/drive/zip", { ...(files.length ? { files: files.join(",") } : {}), ...(folders.length ? { folders: folders.join(",") } : {}) });
    }, [download]);

    // Menu items for a file or folder (Menu / MenuPopover format)
    const menuFor = useCallback((item, list) => {
        const folder = isFolder(item);
        return [
            { label: folder ? "Open" : "Preview", icon: folder ? FolderOpenIcon : EyeIcon, onClick: () => open(item, list) },
            { label: folder ? "Download as ZIP" : "Download", icon: DownloadIcon, onClick: () => download(item) },
            { label: item.is_shared ? "Manage link" : "Share link", icon: Link2Icon, onClick: () => setDialog({ type: "share", item }) },
            { separator: true },
            { label: item.is_starred ? "Remove from Starred" : "Add to Starred", icon: item.is_starred ? StarOffIcon : StarIcon, onClick: () => toggleStar(item) },
            { label: "Rename", icon: PencilIcon, onClick: () => setDialog({ type: "rename", item }) },
            { label: "Move to…", icon: FolderInputIcon, onClick: () => setDialog({ type: "move", items: [item] }) },
            folder && { label: "New folder inside", icon: FolderPlusIcon, onClick: () => newFolder(item.id, item.name) },
            { separator: true },
            { label: "Move to Trash", icon: Trash2Icon, danger: true, onClick: () => trash(item) },
        ].filter(Boolean);
    }, [download, newFolder, open, toggleStar, trash]);

    const value = useMemo(() => ({
        open,
        newFolder,
        rename: (item) => setDialog({ type: "rename", item }),
        move: (item) => setDialog({ type: "move", items: [item] }),
        moveMany: (items) => setDialog({ type: "move", items }),
        starMany,
        trashMany,
        downloadMany,
        share: (item) => setDialog({ type: "share", item }),
        toggleStar,
        trash,
        restore,
        download,
        menuFor,
    }), [open, newFolder, toggleStar, trash, restore, download, menuFor, starMany, trashMany, downloadMany]);

    return (
        <ActionsContext.Provider value={value}>
            {children}
            {preview && (
                <FilePreview
                    key={preview.item.id}
                    item={preview.item}
                    list={preview.list}
                    onNavigate={(item) => setPreview((p) => ({ ...p, item }))}
                    onClose={() => setPreview(null)}
                />
            )}
            {dialog?.type === "new-folder" && (
                <NameModal
                    open
                    onClose={close}
                    title="New folder"
                    subtitle={`In ${dialog.parentName}`}
                    icon={<FolderPlusIcon size={19} />}
                    label="Folder name"
                    initial=""
                    submitLabel="Create folder"
                    onSubmit={(name) => createFolder(name, dialog.parentId)}
                />
            )}
            {dialog?.type === "rename" && (
                <NameModal
                    open
                    onClose={close}
                    title={`Rename ${label(dialog.item).toLowerCase()}`}
                    icon={<PencilIcon size={18} />}
                    label="Name"
                    initial={dialog.item.name}
                    selectBaseName={!isFolder(dialog.item)}
                    submitLabel="Save"
                    onSubmit={(name) => renameItem(dialog.item, name)}
                />
            )}
            {dialog?.type === "move" && <MoveModal items={dialog.items} onClose={close} onMove={moveItems} />}
            {dialog?.type === "share" && <ShareModal item={dialog.item} onClose={close} />}
        </ActionsContext.Provider>
    );
};

// eslint-disable-next-line react/only-export-components -- the hook lives next to its provider
export const useActions = () => useContext(ActionsContext);
