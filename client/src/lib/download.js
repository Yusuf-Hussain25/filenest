import toast from "react-hot-toast";
import api, { errorMessage } from "../config/api";
import { formatBytes, pluralize } from "./format";

// Starts a browser download of `url` (the response says "attachment", so the page stays put)
export const saveFrom = (url) => {
    const a = Object.assign(document.createElement("a"), { href: url, rel: "noopener" });
    document.body.append(a);
    a.click();
    a.remove();
};

// ZIP downloads stream from the API. Ask it first (?check=1) so a problem shows as a toast
// instead of the browser landing on an error page, then let the browser download it.
export const downloadZip = async (path, params = {}) => {
    const query = new URLSearchParams(params);
    try {
        const { data } = await api.get(path, { params: { ...params, check: 1 } });
        toast.success(`Downloading ${data.name} (${pluralize(data.files, "file")}, ${formatBytes(data.size)})`);
        const base = api.defaults.baseURL.replace(/\/$/, "");
        saveFrom(`${base}${path}${query.size ? `?${query}` : ""}`);
        return true;
    } catch (err) {
        toast.error(errorMessage(err, "Could not prepare the download."));
        return false;
    }
};
