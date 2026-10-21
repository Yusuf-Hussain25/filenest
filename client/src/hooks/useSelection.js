import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const EMPTY = new Set();
const isTyping = (el) => el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
const overlayOpen = () => Boolean(document.querySelector("[role=dialog], [role=menu]"));

// Multi-select for a list of items on screen. `resetKey` clears it when the view changes (e.g. a
// different folder). Click toggles, Shift-click selects a range, Ctrl/⌘+A selects everything,
// Esc clears.
export const useSelection = (items, resetKey) => {
    const [state, setState] = useState({ key: resetKey, ids: EMPTY });
    const ids = state.key === resetKey ? state.ids : EMPTY;
    const anchor = useRef(null);
    const latest = useRef({ items, resetKey });

    // Before paint, so keyboard shortcuts never act on the previous folder's items
    useLayoutEffect(() => {
        latest.current = { items, resetKey };
    });

    // Only what's still on screen counts (moved or trashed items drop out)
    const selected = useMemo(() => items.filter((i) => ids.has(i.id)), [items, ids]);

    const toggle = useCallback((item, { range = false } = {}) => {
        const { items: list, resetKey: key } = latest.current;
        // Read the anchor now: the updater below runs later, after it has moved on
        const from = list.findIndex((i) => i.id === anchor.current);
        const to = list.findIndex((i) => i.id === item.id);
        setState((s) => {
            const current = s.key === key ? s.ids : EMPTY;
            const next = new Set(current);
            if (range && from >= 0 && to >= 0) {
                const [a, b] = from < to ? [from, to] : [to, from];
                list.slice(a, b + 1).forEach((i) => next.add(i.id));
            } else if (next.has(item.id)) next.delete(item.id);
            else next.add(item.id);
            return { key, ids: next };
        });
        anchor.current = item.id;
    }, []);

    const clear = useCallback(() => setState({ key: latest.current.resetKey, ids: EMPTY }), []);
    const selectAll = useCallback(() => {
        const { items: list, resetKey: key } = latest.current;
        setState({ key, ids: new Set(list.map((i) => i.id)) });
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (isTyping(document.activeElement) || overlayOpen()) return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && latest.current.items.length) {
                e.preventDefault();
                selectAll();
            } else if (e.key === "Escape") {
                clear();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [clear, selectAll]);

    return { selected, count: selected.length, active: selected.length > 0, isSelected: (id) => ids.has(id), toggle, clear, selectAll };
};
