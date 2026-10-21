import { ClockIcon, HardDriveIcon, Link2Icon, StarIcon, Trash2Icon } from "lucide-react";

// Main sections, shared by the sidebar, the phone tab bar and the search palette.
// count: which number from GET /api/drive/stats to show next to it.
export const NAV = [
    { to: "/", label: "My Files", short: "Files", icon: HardDriveIcon, end: true },
    { to: "/recent", label: "Recent", short: "Recent", icon: ClockIcon },
    { to: "/starred", label: "Starred", short: "Starred", icon: StarIcon, count: "starred" },
    { to: "/shared", label: "Shared links", short: "Shared", icon: Link2Icon, count: "shared" },
    { to: "/trash", label: "Trash", short: "Trash", icon: Trash2Icon },
];

// Folder pages count as "My Files" in the nav
export const isNavActive = (item, pathname) =>
    item.end ? pathname === "/" || pathname.startsWith("/folder/") : pathname.startsWith(item.to);
