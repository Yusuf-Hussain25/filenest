import multer from "multer";
import rateLimit from "express-rate-limit";

const storage = multer.memoryStorage();

// Largest file anyone may upload (direct uploads go straight to storage)
export const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 1073741824); // 1 GB default

// Uploads through the API are held in memory, so they stay capped at 100 MB
export const SERVER_UPLOAD_LIMIT = Math.min(MAX_FILE_SIZE, 104857600);

export const upload = multer({
    storage,
    limits: {
        fileSize: SERVER_UPLOAD_LIMIT,
        files: 10,
    }
})

// Brute-force protection for login and sign-up: 20 failed attempts per 15 minutes per IP
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please wait a few minutes and try again." },
})
