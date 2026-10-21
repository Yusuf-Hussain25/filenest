import express from "express";
import { protect } from "../middleware/auth.js";
import { requireUuidParam } from "../utils/http.js";
import { upload } from "../middleware/upload.js";
import { setStarred } from "../controllers/driveController.js";
import { cancelUpload, completeUpload, createUpload } from "../controllers/uploadController.js";
import { getFilePreviewUrl, getFileText, getFiles, moveFile, permanentDeleteFile, renameFile, restoreFile, softDeleteFile, uploadFiles } from "../controllers/fileController.js";

const fileRouter = express.Router()

fileRouter.param("id", requireUuidParam);

// All file routes require authentication
fileRouter.use(protect);

// Direct-to-storage uploads (presigned PUT), and the classic upload through the API
fileRouter.post("/uploads", createUpload)
fileRouter.post("/uploads/:id/complete", completeUpload)
fileRouter.delete("/uploads/:id", cancelUpload)
fileRouter.post("/upload", upload.array("files", 10), uploadFiles)
fileRouter.get("/", getFiles)
fileRouter.get("/:id/preview", getFilePreviewUrl)
fileRouter.get("/:id/text", getFileText)
fileRouter.patch("/:id/rename", renameFile)
fileRouter.patch("/:id/move", moveFile)
fileRouter.patch("/:id/star", setStarred("files"))
fileRouter.delete("/:id", softDeleteFile)
fileRouter.post("/:id/restore", restoreFile)
fileRouter.delete("/:id/permanent", permanentDeleteFile)

export default fileRouter;
