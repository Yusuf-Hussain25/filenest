// Small request helpers shared by the controllers.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);

// Optional folder reference from a body or query value: null for "root", the id for a valid
// UUID, and undefined for anything else so callers can reject it.
export const parseFolderRef = (value) => {
    if (value === undefined || value === null || value === "" || value === "null" || value === "root") return null;
    return isUuid(value) ? value : undefined;
};

// Router param guard: malformed ids get a 404 instead of a database error.
export const requireUuidParam = (req, res, next, value) => {
    if (!isUuid(value)) return res.status(404).json({ error: "Not found." });
    next();
};

// Log the real error on the server, never send database or storage details to the client.
export const serverError = (res, error) => {
    console.error("[API Error]", error);
    return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
};

// Trimmed display name for a file or folder, or an error message.
export const cleanName = (value, label = "Name") => {
    const name = typeof value === "string" ? value.trim() : "";
    if (!name) return { error: `${label} is required.` };
    if (name.length > 255) return { error: `${label} must be 255 characters or fewer.` };
    if (/[/\\]/.test(name) || /[\u0000-\u001f]/.test(name)) return { error: `${label} can't contain slashes or control characters.` };
    return { name };
};
