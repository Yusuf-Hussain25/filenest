import jwt from "jsonwebtoken";
import { sql } from "../config/db.js";
import { isUuid } from "../utils/http.js";

// Mandatory authentication guard reading the token from the httpOnly cookie
export const protect = async (req, res, next) => {
    const token = req.cookies?.token;

    if(!token) {
        return res.status(401).json({ error: "Unauthorized. Please log in." });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
        return res.status(401).json({error: "Your session has expired. Please log in again."})
    }

    if (!isUuid(decoded?.id)) {
        return res.status(401).json({error: "Your session has expired. Please log in again."})
    }

    try {
        const [user] = await sql`SELECT id, name, email, storage_used, storage_limit, created_at, updated_at FROM users WHERE id = ${decoded.id}`;

        if(!user){
            return res.status(401).json({ error: "User no longer exists." });
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
}
