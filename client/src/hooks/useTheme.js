import { useEffect, useState } from "react";
import { onThemeChange, resolveTheme } from "../lib/theme";

// Current theme ("light" | "dark"), updated on manual toggles.
export const useTheme = () => {
    const [theme, setTheme] = useState(() => resolveTheme());
    useEffect(() => onThemeChange(setTheme), []);
    return theme;
};
