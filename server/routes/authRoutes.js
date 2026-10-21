import express from "express";
import { getMe, loginUser, logoutUser, registerUser } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { authLimiter } from "../middleware/upload.js";

const authRouter = express.Router();

authRouter.post("/register", authLimiter, registerUser)
authRouter.post("/login", authLimiter, loginUser)
authRouter.post("/logout", logoutUser)
authRouter.get("/me", protect, getMe)

export default authRouter;