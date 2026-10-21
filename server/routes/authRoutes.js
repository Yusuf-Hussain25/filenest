import express from "express";
import { changePassword, demoLogin, getMe, loginUser, logoutUser, registerUser, updateProfile } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { authLimiter } from "../middleware/upload.js";

const authRouter = express.Router();

authRouter.post("/register", authLimiter, registerUser)
authRouter.post("/login", authLimiter, loginUser)
authRouter.post("/logout", logoutUser)
authRouter.post("/demo", authLimiter, demoLogin)
authRouter.get("/me", protect, getMe)
authRouter.patch("/me", protect, updateProfile)
authRouter.patch("/password", authLimiter, protect, changePassword)

export default authRouter;