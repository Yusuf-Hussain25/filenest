import { useState } from "react";

// A small per-browser preference (view mode, sort order) kept in localStorage.
export const useLocalPref = (key, fallback, allowed) => {
    const [value, setValue] = useState(() => {
        try {
            const saved = localStorage.getItem(key);
            return saved !== null && (!allowed || allowed.includes(saved)) ? saved : fallback;
        } catch {
            return fallback;
        }
    });
    const update = (next) => {
        setValue(next);
        try {
            localStorage.setItem(key, next);
        } catch {
            // private mode: keep it for this session only
        }
    };
    return [value, update];
};
