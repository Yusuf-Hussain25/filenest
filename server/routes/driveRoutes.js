import express from "express";
import { protect } from "../middleware/auth.js";
import { getFolderTree, getRecent, getStarred, getStats, searchDrive } from "../controllers/driveController.js";

const driveRouter = express.Router()

driveRouter.use(protect)

driveRouter.get("/recent", getRecent)
driveRouter.get("/starred", getStarred)
driveRouter.get("/search", searchDrive)
driveRouter.get("/folders", getFolderTree)
driveRouter.get("/stats", getStats)

export default driveRouter
