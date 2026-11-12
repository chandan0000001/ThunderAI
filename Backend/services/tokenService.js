import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { redisClient } from "../config/redis.js";
import User from "../model/userSchema.js";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * 1000;
const REUSE_GRACE_PERIOD_SECONDS = 60; // 60s window to detect/track reuse of rotated token

const JWT_ISSUER = "thunder-ai";
const JWT_AUDIENCE = "thunder-ai-client";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Generates standard short-lived Access Token (15m)
 * Standard claims: sub, id, email, role, tokenVersion, iss, aud, exp
 */
export const generateAccessToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT Secret key is missing in environment");
    }

    const userId = (user._id || user.id || user.sub).toString();
    const tokenVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 0;

    return jwt.sign(
        {
            sub: userId,
            id: userId,
            email: user.email,
            role: user.role || "user",
            tokenVersion
        },
        process.env.JWT_SECRET,
        {
            expiresIn: ACCESS_TOKEN_TTL,
            algorithm: "HS256",
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        }
    );
};

/**
 * Generates cryptographically secure 256-bit opaque refresh token (64 hex characters)
 */
export const generateRefreshToken = () => {
    return crypto.randomBytes(32).toString("hex");
};

/**
 * Secure SHA-256 hash calculation for refresh tokens at rest
 */
export const hashRefreshToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Persists hashed refresh token and tracks token family in Redis
 */
export const storeRefreshToken = async (refreshToken, userId, email, familyId, tokenVersion = 0) => {
    if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis connection required for session management");
    }

    const tokenHash = hashRefreshToken(refreshToken);
    const record = JSON.stringify({
        userId: userId.toString(),
        email,
        familyId,
        tokenVersion: typeof tokenVersion === "number" ? tokenVersion : 0,
        createdAt: Date.now()
    });

    await redisClient.set(`refresh_token:${tokenHash}`, record, { EX: REFRESH_TOKEN_TTL_SECONDS });
    await redisClient.set(`refresh_family:${familyId}`, "active", { EX: REFRESH_TOKEN_TTL_SECONDS });
};

/**
 * Atomically rotates a refresh token, enforcing reuse detection and token family revocation
 */
export const rotateRefreshToken = async (oldRefreshToken) => {
    if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis connection required for token rotation");
    }

    const oldHash = hashRefreshToken(oldRefreshToken);

    // 1. Check for token reuse (if oldHash is found in revoked registry, token was already used)
    const revokedRecordStr = await redisClient.get(`refresh_revoked:${oldHash}`);
    if (revokedRecordStr) {
        const revokedData = JSON.parse(revokedRecordStr);
        const { familyId, userId } = revokedData;

        // Revoke the entire family immediately
        if (familyId) {
            await redisClient.del(`refresh_family:${familyId}`);
        }

        // Increment user tokenVersion to revoke all active sessions across all devices
        if (userId && mongoose.connection?.readyState === 1) {
            try {
                const user = await User.findByIdAndUpdate(
                    userId,
                    { $inc: { tokenVersion: 1 } },
                    { returnDocument: "after" }
                );
                if (user) {
                    await redisClient.set(`user:tokenVersion:${userId}`, user.tokenVersion.toString(), { EX: REFRESH_TOKEN_TTL_SECONDS });
                }
            } catch (err) {
                console.error("Failed to increment user tokenVersion during reuse revocation:", err);
            }
        }

        const reuseErr = new Error("Token reuse detected. All active sessions have been revoked.");
        reuseErr.code = "TOKEN_REUSE";
        throw reuseErr;
    }

    // 2. Lookup active refresh token
    const tokenRecordStr = await redisClient.get(`refresh_token:${oldHash}`);
    if (!tokenRecordStr) {
        const invalidErr = new Error("Refresh token is invalid or expired.");
        invalidErr.code = "INVALID_TOKEN";
        throw invalidErr;
    }

    const tokenRecord = JSON.parse(tokenRecordStr);
    const { userId, email, familyId, tokenVersion } = tokenRecord;

    // 3. Verify family is still active
    const familyStatus = await redisClient.get(`refresh_family:${familyId}`);
    if (familyStatus !== "active") {
        const familyErr = new Error("Session family has been revoked. Please sign in again.");
        familyErr.code = "FAMILY_REVOKED";
        throw familyErr;
    }

    // 4. Verify user and active tokenVersion
    const user = await User.findById(userId);
    if (!user) {
        const userErr = new Error("User account no longer exists.");
        userErr.code = "USER_NOT_FOUND";
        throw userErr;
    }

    const currentTokenVersion = user.tokenVersion || 0;
    if (currentTokenVersion !== tokenVersion) {
        // Stale session version (e.g. after password reset)
        await redisClient.del(`refresh_family:${familyId}`);
        await redisClient.del(`refresh_token:${oldHash}`);
        const staleErr = new Error("Session revoked due to password or credential update.");
        staleErr.code = "VERSION_MISMATCH";
        throw staleErr;
    }

    // 5. Generate replacement tokens
    const newRefreshToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRefreshToken);

    const newRecord = JSON.stringify({
        userId: user._id.toString(),
        email: user.email,
        familyId,
        tokenVersion: currentTokenVersion,
        createdAt: Date.now()
    });

    // 6. Atomic swap: Store new, remove old, record old in revoked registry with grace TTL
    await redisClient.set(`refresh_token:${newHash}`, newRecord, { EX: REFRESH_TOKEN_TTL_SECONDS });
    await redisClient.del(`refresh_token:${oldHash}`);
    await redisClient.set(
        `refresh_revoked:${oldHash}`,
        JSON.stringify({ familyId, userId: user._id.toString(), rotatedAt: Date.now() }),
        { EX: REUSE_GRACE_PERIOD_SECONDS }
    );

    const newAccessToken = generateAccessToken(user);

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user
    };
};

/**
 * Cookie configuration policies
 */
export const getAccessTokenCookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 15 * 60 * 1000 // 15 minutes
});

export const getRefreshTokenCookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS // 7 days
});

const REFRESH_COOKIE_OPTS = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/"
};

/**
 * Attaches both Access and Refresh token cookies to response
 */
export const setAuthCookies = async (res, user) => {
    const familyId = crypto.randomUUID();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await storeRefreshToken(refreshToken, user._id, user.email, familyId, user.tokenVersion || 0);

    res.cookie("token", accessToken, getAccessTokenCookieOptions());
    res.cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

    return { accessToken, refreshToken, familyId };
};

/**
 * Clears auth cookies and revokes tokens upon logout
 */
export const clearAuthCookies = async (req, res) => {
    // 1. Blocklist access token if valid
    if (req.token && req.tokenPayload?.exp && redisClient && redisClient.isOpen) {
        const currentTime = Math.floor(Date.now() / 1000);
        const remainingTime = req.tokenPayload.exp - currentTime;
        if (remainingTime > 0) {
            try {
                await redisClient.set(`blocklist:${req.token}`, "blocked", { EX: remainingTime });
            } catch (err) {
                console.warn("Logout blocklist error:", err.message);
            }
        }
    }

    // 2. Revoke refresh token and associated family
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken && redisClient && redisClient.isOpen) {
        try {
            const tokenHash = hashRefreshToken(refreshToken);
            const tokenRecordStr = await redisClient.get(`refresh_token:${tokenHash}`);
            if (tokenRecordStr) {
                const tokenRecord = JSON.parse(tokenRecordStr);
                if (tokenRecord.familyId) {
                    await redisClient.del(`refresh_family:${tokenRecord.familyId}`);
                }
                await redisClient.del(`refresh_token:${tokenHash}`);
            }
        } catch (err) {
            console.warn("Logout refresh token revocation error:", err.message);
        }
    }

    res.clearCookie("token", REFRESH_COOKIE_OPTS);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTS);
};
