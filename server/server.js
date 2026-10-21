import express from "express";
import "dotenv/config";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";
import { initDB } from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import folderRouter from "./routes/folderRoutes.js";
import fileRouter from "./routes/fileRoutes.js";
import trashRouter from "./routes/trashRoutes.js";
import shareRouter from "./routes/shareRoutes.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error("JWT_SECRET is missing or too short (use 32+ characters). Generate one with: openssl rand -hex 32");
    process.exit(1);
}

const app = express()
app.disable("x-powered-by")
// Behind a hosting proxy the client IP is in X-Forwarded-For (used by the rate limits)
app.set("trust proxy", 1)

// CORS: only the configured web app origins may call the API with cookies
const allowedOrigins = (process.env.ORIGINS || "http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({origin: allowedOrigins, credentials: true}))

// Middlewares
app.use(helmet())
app.use(cookieParser())
app.use(express.json({limit: "1mb"}))

// Root API
app.get("/", (_req, res) => res.send("Filenest API is running"))

// App API routes
app.use("/api/auth", authRouter)
app.use("/api/folders", folderRouter)
app.use("/api/files", fileRouter)
app.use("/api/trash", trashRouter)
app.use("/api/shares", shareRouter)

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }))

// Error handling: readable messages for upload limits, nothing internal for the rest
app.use((err, _req, res, _next)=>{
    if (err instanceof multer.MulterError) {
        const maxMb = Math.round(Number(process.env.MAX_FILE_SIZE || 104857600) / 1048576);
        const message = err.code === "LIMIT_FILE_SIZE"
            ? `Each file can be at most ${maxMb} MB.`
            : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
                ? "Too many files in one upload."
                : "Upload failed.";
        return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: message });
    }
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Invalid JSON body." });
    }
    if (err.type === "entity.too.large") {
        return res.status(413).json({ error: "Request body is too large." });
    }
    console.error("[Unhandled Error]", err);
    res.status(500).json({error: "Something went wrong on our side. Please try again." })
})

const port = process.env.PORT || 3000;

// Initialize DB connection then start server
initDB().then(()=>{
    app.listen(port, ()=>{
    console.log(`Server running at http://localhost:${port}`)
    })
}).catch(() => {
    console.error("Could not connect to the database. Check DATABASE_URL in server/.env (for local dev, run `npm run services` first).");
    process.exit(1);
})
