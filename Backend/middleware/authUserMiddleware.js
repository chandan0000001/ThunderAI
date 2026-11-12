import jwt from "jsonwebtoken";
import { redisClient } from "../config/redis.js";
import User from "../model/userSchema.js";

const authUserMiddleware = async (req, res, next) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            return res.status(401).json({
                message: "You need to login first"
            });
        }

        const blockedToken = await redisClient.get(
            `blocklist:${token}`
        );

        if (blockedToken) {
            return res.status(401).json({
                message: "Please login again"
            });
        }

        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        // F-07 Remediation: Validate token/session versioning against active revocation registry
        if (payload.tokenVersion !== undefined) {
            const cacheKey = `user:tokenVersion:${payload.id}`;
            let currentVersion = null;
            try {
                if (redisClient && redisClient.isOpen) {
                    currentVersion = await redisClient.get(cacheKey);
                }
            } catch {}

            if (currentVersion === null) {
                const user = await User.findById(payload.id).select("tokenVersion").lean();
                if (!user) {
                    return res.status(401).json({ message: "User account no longer exists" });
                }
                currentVersion = (user.tokenVersion || 0).toString();
                try {
                    if (redisClient && redisClient.isOpen) {
                        await redisClient.set(cacheKey, currentVersion, { EX: 300 });
                    }
                } catch {}
            }

            if (Number(currentVersion) !== Number(payload.tokenVersion)) {
                return res.status(401).json({
                    message: "Session expired due to a recent password change. Please log in again."
                });
            }
        }

        req.userId = payload.id;
        req.token = token;
        req.tokenPayload = payload;

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "You need to login first"
            });
        }
        
        console.error("authUserMiddleware error:", error.message || error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

export default authUserMiddleware;