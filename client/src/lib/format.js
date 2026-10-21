// Formatting helpers for sizes, dates and counts.

// 1536 -> "1.5 KB", 0 -> "0 B"
export const formatBytes = (bytes, decimals = 1) => {
    const num = Number(bytes);
    if (!num || num < 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(num) / Math.log(1024)));
    const value = num / 1024 ** i;
    return `${i === 0 ? value : parseFloat(value.toFixed(value >= 100 ? 0 : decimals))} ${units[i]}`;
};

export const toDate = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// "12 Oct 2026" (year only when it isn't this year)
export const formatDate = (value) => {
    const date = toDate(value);
    if (!date) return "";
    const opts = { day: "numeric", month: "short" };
    if (date.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
    return date.toLocaleDateString([], opts);
};

// "12 Oct 2026, 9:05 PM"
export const formatDateTime = (value) => {
    const date = toDate(value);
    if (!date) return "";
    return date.toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};

// "just now", "5m ago", "3h ago", "Yesterday", "2d ago", "12 Oct"; future: "in 3h", "in 6d"
export const formatRelative = (value) => {
    const date = toDate(value);
    if (!date) return "";
    const diff = date.getTime() - Date.now();
    const mins = Math.round(Math.abs(diff) / 60000);
    if (mins < 1) return "just now";
    const future = diff > 0;
    const label =
        mins < 60 ? `${mins}m` :
        mins < 60 * 24 ? `${Math.round(mins / 60)}h` :
        mins < 60 * 24 * 14 ? `${Math.round(mins / 1440)}d` :
        null;
    if (!label) return formatDate(date);
    if (!future && label === "1d") return "Yesterday";
    return future ? `in ${label}` : `${label} ago`;
};

// Group label for date-grouped lists: Today, Yesterday, This week, This month, Earlier
export const dayGroup = (value) => {
    const date = toDate(value);
    if (!date) return "Earlier";
    const now = new Date();
    if (sameDay(date, now)) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay(date, yesterday)) return "Yesterday";
    const days = (now - date) / 86400000;
    if (days < 7) return "This week";
    if (days < 31) return "This month";
    return "Earlier";
};

// pluralize(3, "file") -> "3 files"
export const pluralize = (count, word, plural = `${word}s`) => `${count} ${count === 1 ? word : plural}`;

export const greeting = (date = new Date()) => {
    const h = date.getHours();
    if (h < 5) return "Working late";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
};
