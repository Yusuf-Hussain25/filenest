// Tiny event bus: anything that changes the drive (upload, rename, move, trash ...) calls
// emitDriveChange(), and every open view refreshes itself.
const listeners = new Set();

export const onDriveChange = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

export const emitDriveChange = () => listeners.forEach((fn) => fn());
