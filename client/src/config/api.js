import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL,
    withCredentials: true,
});

// Readable message from a failed request
export const errorMessage = (err, fallback = "Something went wrong. Please try again.") => {
    if (err?.response?.data?.error) return err.response.data.error;
    if (err?.code === "ERR_NETWORK") return "Can't reach the Filenest server. Check your connection and try again.";
    return fallback;
};

export default api;
