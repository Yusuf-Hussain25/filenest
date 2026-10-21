// File kinds: which icon, color and preview each MIME type gets.
import {
    FileArchiveIcon, FileAudioIcon, FileCode2Icon, FileIcon, FileImageIcon, FileSpreadsheetIcon,
    FileTextIcon, FileVideoIcon, PresentationIcon, FileTypeIcon,
} from "lucide-react";

// Order matters: first match wins
const KINDS = [
    { key: "image", label: "Image", test: (m) => m.startsWith("image/"), icon: FileImageIcon, from: "#c4b5fd", to: "#7c3aed" },
    { key: "video", label: "Video", test: (m) => m.startsWith("video/"), icon: FileVideoIcon, from: "#fda4af", to: "#e11d48" },
    { key: "audio", label: "Audio", test: (m) => m.startsWith("audio/"), icon: FileAudioIcon, from: "#f9a8d4", to: "#db2777" },
    { key: "pdf", label: "PDF", test: (m) => m === "application/pdf", icon: FileTypeIcon, from: "#fca5a5", to: "#dc2626" },
    { key: "sheet", label: "Spreadsheet", test: (m) => /(sheet|excel|csv)/.test(m), icon: FileSpreadsheetIcon, from: "#6ee7b7", to: "#059669" },
    { key: "slides", label: "Presentation", test: (m) => /(presentation|powerpoint)/.test(m), icon: PresentationIcon, from: "#fcd34d", to: "#d97706" },
    { key: "archive", label: "Archive", test: (m) => /(zip|tar|rar|7z|gzip|compressed)/.test(m), icon: FileArchiveIcon, from: "#fdba74", to: "#c2410c" },
    { key: "code", label: "Code", test: (m) => /(json|javascript|typescript|html|css|xml|x-python|x-sh|yaml)/.test(m), icon: FileCode2Icon, from: "#67e8f9", to: "#0891b2" },
    { key: "doc", label: "Document", test: (m) => m.startsWith("text/") || /(word|document|rtf|opendocument\.text)/.test(m), icon: FileTextIcon, from: "#93c5fd", to: "#2563eb" },
];

const OTHER = { key: "other", label: "File", icon: FileIcon, from: "#cbd5e1", to: "#475569" };

export const fileKind = (mime = "") => KINDS.find((k) => k.test(mime.toLowerCase())) || OTHER;

// "report.final.pdf" -> "PDF"
export const extensionOf = (name = "") => {
    const i = name.lastIndexOf(".");
    return i > 0 && i < name.length - 1 ? name.slice(i + 1).toUpperCase().slice(0, 5) : "";
};

// What the preview can show inline
export const previewMode = (mime = "") => {
    const m = mime.toLowerCase();
    if (m.startsWith("image/")) return "image";
    if (m.startsWith("video/")) return "video";
    if (m.startsWith("audio/")) return "audio";
    if (m === "application/pdf") return "pdf";
    if (m.startsWith("text/") || /(json|javascript|xml|yaml|x-sh|x-python|markdown)/.test(m)) return "text";
    return "none";
};

// Storage categories from GET /api/drive/stats, in their fixed color order.
// Colors are theme tokens (index.css) from a palette checked for color-blind separation.
export const CATEGORIES = {
    documents: { label: "Documents", color: "var(--cat-documents)" },
    images: { label: "Images", color: "var(--cat-images)" },
    videos: { label: "Videos", color: "var(--cat-videos)" },
    audio: { label: "Audio", color: "var(--cat-audio)" },
    archives: { label: "Archives", color: "var(--cat-archives)" },
    other: { label: "Other", color: "var(--cat-other)" },
};

export const SORT_OPTIONS = [
    { value: "name_asc", label: "Name (A to Z)" },
    { value: "name_desc", label: "Name (Z to A)" },
    { value: "date_desc", label: "Newest first" },
    { value: "date_asc", label: "Oldest first" },
    { value: "size_desc", label: "Largest first" },
    { value: "size_asc", label: "Smallest first" },
];

export const isFolder = (item) => item?.kind === "folder" || (item && !("mime_type" in item));
