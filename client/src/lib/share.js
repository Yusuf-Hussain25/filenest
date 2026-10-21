// Public link helpers.

export const shareUrl = (token) => `${window.location.origin}/s/${token}`;

// Copies text, falling back to a hidden textarea where the Clipboard API is blocked
export const copyText = async (value) => {
    try {
        await navigator.clipboard.writeText(value);
    } catch {
        const el = Object.assign(document.createElement("textarea"), { value });
        document.body.append(el);
        el.select();
        document.execCommand("copy");
        el.remove();
    }
};

// "never" | "expired" | "soon" (within 2 days) | "active"
export const linkState = (link) => {
    if (!link?.expires_at) return "never";
    const ms = new Date(link.expires_at) - Date.now();
    if (ms <= 0) return "expired";
    return ms < 2 * 86400000 ? "soon" : "active";
};
