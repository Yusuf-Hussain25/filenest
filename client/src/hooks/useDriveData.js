import { useCallback, useEffect, useRef, useState } from "react";
import { onDriveChange } from "../lib/events";

// Loads data with `load()` whenever `key` changes, and quietly reloads (no skeleton) when the
// drive changes. Responses that arrive after a newer request are dropped, so fast navigation
// never shows the wrong folder.
export const useDriveData = (load, key) => {
    const [state, setState] = useState({ data: null, error: null, loading: true });
    const loadRef = useRef(load);
    const requestId = useRef(0);

    useEffect(() => {
        loadRef.current = load;
    });

    const run = useCallback(async (silent) => {
        const id = ++requestId.current;
        if (!silent) setState((s) => ({ data: s.key === key ? s.data : null, error: null, loading: true, key }));
        try {
            const data = await loadRef.current();
            if (id === requestId.current) setState({ data, error: null, loading: false, key });
        } catch (error) {
            if (id === requestId.current) setState((s) => ({ data: silent ? s.data : null, error, loading: false, key }));
        }
    }, [key]);

    useEffect(() => {
        // Fetching when the key changes is what this hook is for; the loading state is set first
        // oxlint-disable-next-line react/set-state-in-effect
        run(false);
    }, [run]);

    useEffect(() => onDriveChange(() => run(true)), [run]);

    return { ...state, reload: () => run(true) };
};
