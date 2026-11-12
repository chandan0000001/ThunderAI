import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { redisClient } from "../config/redis.js";
import User from "../model/userSchema.js";
import { getRefreshTokenTTLSeconds } from "../services/tokenService.js";

/**
 * F-09 & Section 4: Strict Authentication & Session Validation Middleware
 * Enforces:
 * 1. HS256 algorithm allowlist, strict issuer ('thunder-ai'), and audience ('thunder-ai-client').
 * 2. Active Redis token blocklist verification.
 * 3. Mandatory numeric tokenVersion claim (rejects legacy or malformed tokens fail-closed).
 * 4. Token version validation against active revocation registry / database.
 */
const authUserMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.token || (
            req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.slice(7)
                : null
        );

        if (!token) {
            return res.status(401).json({
                message: "You need to login first"
            });
        }

        // F-18 Remediation: Require confirmed revocation check before accepting session
        if (!redisClient || !redisClient.isOpen) {
            if (process.env.NODE_ENV === "production") {
                return res.status(503).json({
                    message: "Authentication service unavailable. Session revocation checks cannot be verified."
                });
            }
        }

        let blockedToken = null;
        try {
            if (redisClient && redisClient.isOpen) {
                blockedToken = await redisClient.get(`blocklist:${token}`);
            }
        } catch (redisErr) {
            if (process.env.NODE_ENV === "production") {
                return res.status(503).json({
                    message: "Authentication service degraded. Revocation checks cannot be completed."
                });
            }
        }

        if (blockedToken) {
            return res.status(401).json({
                message: "Session has been invalidated. Please log in again."
            });
        }

        // Section 4: Verify signature and standard claims
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"],
                issuer: "thunder-ai",
                audience: "thunder-ai-client"
            }
        );

        const userId = payload.sub || payload.id;
        if (!userId) {
            return res.status(401).json({
                message: "Session token payload missing subject. Please log in again."
            });
        }

        // F-09: Mandatory tokenVersion verification; reject missing, null, non-numeric, or negative claims
        if (
            payload.tokenVersion === undefined ||
            payload.tokenVersion === null ||
            typeof payload.tokenVersion !== "number" ||
            !Number.isInteger(payload.tokenVersion) ||
            payload.tokenVersion < 0
        ) {
            return res.status(401).json({
                message: "Session token lacks mandatory tokenVersion. Please log in again."
            });
        }

        // F-20 Remediation: Authoritative TokenVersion Verification
        // Do not accept stale Redis cache after database changes. MongoDB is authoritative.
        const cacheKey = `user:tokenVersion:${userId}`;

        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const user = await User.findById(userId).select("tokenVersion").lean();
            if (!user) {
                return res.status(401).json({ message: "User account no longer exists." });
            }
            const authoritativeVersion = user.tokenVersion || 0;

            // Heal and synchronize Redis cache with authoritative database state
            try {
                if (redisClient && redisClient.isOpen) {
                    await redisClient.set(cacheKey, authoritativeVersion.toString(), {
                        EX: getRefreshTokenTTLSeconds()
                    });
                }
            } catch {}

            if (Number(authoritativeVersion) !== Number(payload.tokenVersion)) {
                return res.status(401).json({
                    message: "Session expired or revoked. Please log in again."
                });
            }
        } else {
            // If MongoDB is unavailable in production, fail closed
            if (process.env.NODE_ENV === "production") {
                return res.status(503).json({
                    message: "Authentication service unavailable: database offline."
                });
            }

            // In non-production testing with offline DB, verify against Redis cache if present
            let cachedVersion = null;
            try {
                if (redisClient && redisClient.isOpen) {
                    cachedVersion = await redisClient.get(cacheKey);
                }
            } catch {}

            if (cachedVersion !== null && Number(cachedVersion) !== Number(payload.tokenVersion)) {
                return res.status(401).json({
                    message: "Session expired or revoked. Please log in again."
                });
            }
        }

        req.userId = userId;
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
