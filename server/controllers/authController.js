import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sql } from "../config/db.js";
import { serverError } from "../utils/http.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Compared against when the email is unknown, so both paths take the same time
const DUMMY_HASH = bcrypt.hashSync("filenest-timing-guard", 10);

const cookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
    };
};

// Signs a JWT and attaches it to the response as an httpOnly cookie (never in the body)
export const sendTokenResponse = (res, userId, statusCode = 200, extraData = {})=>{
    const token = jwt.sign({id: userId}, process.env.JWT_SECRET, {expiresIn: "7d", algorithm: "HS256"})

    res.cookie("token", token, {
        ...cookieOptions(),
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    res.status(statusCode).json(extraData)
}

// Register new user
// POST /api/auth/register
export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body ?? {};
        if(typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || !name.trim() || !email.trim() || !password){
            return res.status(400).json({error: "Name, email, and password are required."})
        }
        if (name.trim().length > 80) {
            return res.status(400).json({error: "Name must be 80 characters or fewer."})
        }

        const normalizedEmail = email.toLowerCase().trim();
        if (!EMAIL_RE.test(normalizedEmail) || normalizedEmail.length > 255) {
            return res.status(400).json({error: "Enter a valid email address."})
        }
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({error: "Password must be 8 to 128 characters."})
        }

        const [existing] = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;

        if(existing){
            return res.status(400).json({error: "An account with this email already exists. Log in instead."})
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const storageLimit = Number(process.env.MAX_STORAGE_PER_USER || 1073741824);

        const [user] = await sql`INSERT INTO users (name, email, password, storage_limit)
        VALUES (${name.trim()}, ${normalizedEmail}, ${hashedPassword}, ${storageLimit})
        ON CONFLICT (email) DO NOTHING
        RETURNING id, name, email, storage_used, storage_limit, created_at, updated_at`;

        if (!user) {
            return res.status(400).json({error: "An account with this email already exists. Log in instead."})
        }

        return sendTokenResponse(res, user.id, 201, {user});
    } catch (error) {
        return serverError(res, error)
    }
}

// Login user
// POST /api/auth/login
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body ?? {};
        if(typeof email !== "string" || typeof password !== "string" || !email.trim() || !password){
            return res.status(400).json({error: "Email and password are required."})
        }

        const normalizedEmail = email.toLowerCase().trim();

        const [user] = await sql`SELECT id, name, email, password, storage_used, storage_limit, created_at, updated_at FROM users WHERE email = ${normalizedEmail}`;

        const isMatch = await bcrypt.compare(password, user?.password ?? DUMMY_HASH)
        if(!user || !isMatch){
            return res.status(401).json({error: "Invalid email or password."})
        }

        delete user.password;

        return sendTokenResponse(res, user.id, 200, {user});
    } catch (error) {
        return serverError(res, error)
    }
}

// Logout user & clear cookie
// POST /api/auth/logout
export const logoutUser = async (_req, res) => {
    res.clearCookie("token", cookieOptions())
    return res.status(200).json({message: "Logged out successfully."})
}

// Get current user profile & storage info
// GET /api/auth/me
export const getMe = async (req, res) => {
    // req.user is already loaded by protect middleware
    return res.status(200).json({user: {...req.user, is_demo: isDemoUser(req.user)}})
}

const isDemoUser = (user) => Boolean(process.env.DEMO_EMAIL) && user.email === process.env.DEMO_EMAIL.toLowerCase().trim();

// One-click sign-in to the seeded demo account (only when DEMO_EMAIL is set)
// POST /api/auth/demo
export const demoLogin = async (_req, res) => {
    try {
        const demoEmail = process.env.DEMO_EMAIL?.toLowerCase().trim();
        if (!demoEmail) {
            return res.status(404).json({error: "The demo account is not enabled."})
        }
        const [user] = await sql`SELECT id, name, email, storage_used, storage_limit, created_at, updated_at FROM users WHERE email = ${demoEmail}`;
        if (!user) {
            return res.status(503).json({error: "The demo account isn't set up yet. Run `npm run seed` first."})
        }
        return sendTokenResponse(res, user.id, 200, {user: {...user, is_demo: true}});
    } catch (error) {
        return serverError(res, error)
    }
}

// Update display name
// PATCH /api/auth/me
export const updateProfile = async (req, res) => {
    try {
        if (isDemoUser(req.user)) {
            return res.status(403).json({error: "The demo account's profile can't be changed. Create your own account to try this."})
        }
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
        if (!name || name.length > 80) {
            return res.status(400).json({error: "Name must be 1 to 80 characters."})
        }
        const [user] = await sql`UPDATE users SET name = ${name}, updated_at = NOW() WHERE id = ${req.user.id}
        RETURNING id, name, email, storage_used, storage_limit, created_at, updated_at`;
        return res.status(200).json({user});
    } catch (error) {
        return serverError(res, error)
    }
}

// Change password (needs the current one)
// PATCH /api/auth/password
export const changePassword = async (req, res) => {
    try {
        if (isDemoUser(req.user)) {
            return res.status(403).json({error: "The demo account's password can't be changed."})
        }
        const { current_password: current, new_password: next } = req.body ?? {};
        if (typeof current !== "string" || typeof next !== "string" || !current) {
            return res.status(400).json({error: "Enter your current and new password."})
        }
        if (next.length < 8 || next.length > 128) {
            return res.status(400).json({error: "New password must be 8 to 128 characters."})
        }
        const [row] = await sql`SELECT password FROM users WHERE id = ${req.user.id}`;
        if (!(await bcrypt.compare(current, row.password))) {
            return res.status(400).json({error: "Your current password is incorrect."})
        }
        const hashed = await bcrypt.hash(next, 10);
        await sql`UPDATE users SET password = ${hashed}, updated_at = NOW() WHERE id = ${req.user.id}`;
        return res.status(200).json({message: "Password updated."});
    } catch (error) {
        return serverError(res, error)
    }
}
