import express from "express";
import { getMe, loginUser, logoutUser, registerUser } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const authRouter = express.Router();

authRouter.post("/register", registerUser)
authRouter.post("/login", loginUser)
authRouter.post("/logout", logoutUser)
authRouter.get("/me", protect, getMe)

export default authRouter;