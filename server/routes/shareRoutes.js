import express from "express";
import { accessShareLink, createShareLink, deleteShareLink, getUserShareLinks, updateShareLink } from "../controllers/shareController.js";
import { protect } from "../middleware/auth.js";
import { requireUuidParam } from "../utils/http.js";

const shareRouter = express.Router()

shareRouter.param("id", requireUuidParam)

// Public link access (anyone with the link)
shareRouter.get("/access/:token", accessShareLink)

// Protected share management endpoints
shareRouter.use(protect)

shareRouter.post("/", createShareLink)
shareRouter.get("/", getUserShareLinks)
shareRouter.patch("/:id", updateShareLink)
shareRouter.delete("/:id", deleteShareLink)

export default shareRouter