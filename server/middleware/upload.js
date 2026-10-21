import multer from "multer";
import rateLimit from "express-rate-limit";

const storage = multer.memoryStorage();

const maxFileSize = process.env.MAX_FILE_SIZE ? Number(process.env.MAX_FILE_SIZE) : 104857600 // 100 MB default

export const upload = multer({
    storage,
    limits: {
        fileSize: maxFileSize,
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
