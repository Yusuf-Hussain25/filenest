import express from "express";
import { protect } from "../middleware/auth.js";
import { requireUuidParam } from "../utils/http.js";
import { setStarred } from "../controllers/driveController.js";
import { folderZip } from "../controllers/zipController.js";
import { createFolder, createFolderPaths, getFolderDetails, getFolders, moveFolder, permanentDeleteFolder, renameFolder, restoreFolder, softDeleteFolder } from "../controllers/folderController.js";

const folderRouter = express.Router()

folderRouter.param("id", requireUuidParam)

folderRouter.use(protect)

folderRouter.post("/", createFolder)
folderRouter.post("/paths", createFolderPaths)
folderRouter.get("/", getFolders)
folderRouter.get("/:id", getFolderDetails)
folderRouter.get("/:id/zip", folderZip)
folderRouter.patch("/:id/rename", renameFolder)
folderRouter.patch("/:id/move", moveFolder)
folderRouter.patch("/:id/star", setStarred("folders"))
folderRouter.delete("/:id", softDeleteFolder)
folderRouter.post("/:id/restore", restoreFolder)
folderRouter.delete("/:id/permanent", permanentDeleteFolder)

export default folderRouter