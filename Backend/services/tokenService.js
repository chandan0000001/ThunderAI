import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { redisClient } from "../config/redis.js";
import User from "../model/userSchema.js";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL_SECONDS = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS || "604800", 10); // 7 days (604800s) default
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * 1000;

const JWT_ISSUER = "thunder-ai";
const JWT_AUDIENCE = "thunder-ai-client";

const isProduction = process.env.NODE_ENV === "production";

/**
 * F-14 & F-15: Redis Lua script for strictly atomic refresh-token rotation and reuse detection.
 * Executes in a single atomic transaction:
 * 1. Checks if the presented token hash was already revoked (Reuse Detection).
 * 2. Checks if the active token exists.
 * 3. Verifies that the token family is active.
 * 4. Atomically consumes old token (DEL).
 * 5. Atomically registers old token in revoked registry for the FULL family lifetime (F-15).
 * 6. Atomically stores new replacement token.
 */
const ATOMIC_ROTATION_LUA = `
local revokedKey = KEYS[1]
local oldTokenKey = KEYS[2]
local newTokenKey = KEYS[3]

local newTokenVal = ARGV[1]
local ttlSeconds = tonumber(ARGV[2])
local rotatedAt = ARGV[3]

-- 1. Check if token was already revoked (Token Reuse Detection)
local revoked = redis.call('GET', revokedKey)
if revoked then
    return {'REUSE_DETECTED', revoked}
end

-- 2. Check if active token exists
local current = redis.call('GET', oldTokenKey)
if not current then
    return {'INVALID_TOKEN', ''}
end

-- 3. Parse token data and verify active family
local data = cjson.decode(current)
local familyKey = 'refresh_family:' .. (data.familyId or '')
local famStatus = redis.call('GET', familyKey)
if famStatus ~= 'active' then
    return {'FAMILY_REVOKED', ''}
end

-- 4. Atomically consume old token
redis.call('DEL', oldTokenKey)

-- 5. Mark old token as revoked for the FULL family lifetime (F-15 remediation)
local revokedPayload = cjson.encode({
    familyId = data.familyId,
    userId = data.userId,
    rotatedAt = rotatedAt
})
redis.call('SET', revokedKey, revokedPayload, 'EX', ttlSeconds)

-- 6. Store replacement token
redis.call('SET', newTokenKey, newTokenVal, 'EX', ttlSeconds)

return {'OK', current}
`;

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
 * F-14 & F-15 Remediation:
 * Atomically rotates a refresh token using a Redis Lua script, enforcing atomic token
 * swap, full-lifetime reuse retention, and token family revocation.
 */
export const rotateRefreshToken = async (oldRefreshToken) => {
    if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis connection required for token rotation");
    }

    const oldHash = hashRefreshToken(oldRefreshToken);
    const newRefreshToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRefreshToken);

    const revokedKey = `refresh_revoked:${oldHash}`;
    const oldTokenKey = `refresh_token:${oldHash}`;
    const newTokenKey = `refresh_token:${newHash}`;

    const nowStr = Date.now().toString();

    const provisionalRecord = JSON.stringify({
        newHash,
        rotatedAt: nowStr
    });

    // Execute atomic rotation Lua script
    const result = await redisClient.eval(ATOMIC_ROTATION_LUA, {
        keys: [revokedKey, oldTokenKey, newTokenKey],
        arguments: [provisionalRecord, REFRESH_TOKEN_TTL_SECONDS.toString(), nowStr]
    });

    const status = result[0];
    const payload = result[1];

    if (status === "REUSE_DETECTED") {
        let familyId = null;
        let userId = null;
        try {
            const parsed = JSON.parse(payload);
            familyId = parsed.familyId;
            userId = parsed.userId;
        } catch {}

        if (familyId) {
            await redisClient.del(`refresh_family:${familyId}`);
        }

        if (userId && mongoose.connection?.readyState === 1) {
            try {
                const user = await User.findByIdAndUpdate(
                    userId,
                    { $inc: { tokenVersion: 1 } },
                    { returnDocument: "after" }
                );
                if (user) {
                    await redisClient.set(
                        `user:tokenVersion:${userId}`,
                        user.tokenVersion.toString(),
                        { EX: REFRESH_TOKEN_TTL_SECONDS }
                    );
                }
            } catch (err) {
                console.error("Failed to increment user tokenVersion during reuse revocation:", err);
            }
        }

        const reuseErr = new Error("Token reuse detected. All active sessions have been revoked.");
        reuseErr.code = "TOKEN_REUSE";
        throw reuseErr;
    }

    if (status === "INVALID_TOKEN") {
        const invalidErr = new Error("Refresh token is invalid or expired.");
        invalidErr.code = "INVALID_TOKEN";
        throw invalidErr;
    }

    if (status === "FAMILY_REVOKED") {
        const familyErr = new Error("Session family has been revoked. Please sign in again.");
        familyErr.code = "FAMILY_REVOKED";
        throw familyErr;
    }

    // Status is 'OK' - payload is the old token's JSON record
    const tokenRecord = JSON.parse(payload);
    const { userId, email, familyId, tokenVersion } = tokenRecord;

    // Verify user exists and tokenVersion matches in DB
    let user = null;
    if (mongoose.connection?.readyState === 1) {
        user = await User.findById(userId);
    } else {
        user = { _id: userId, email, tokenVersion };
    }

    if (!user) {
        await redisClient.del(newTokenKey);
        await redisClient.del(`refresh_family:${familyId}`);
        const userErr = new Error("User account no longer exists.");
        userErr.code = "USER_NOT_FOUND";
        throw userErr;
    }

    const currentTokenVersion = user.tokenVersion || 0;
    if (currentTokenVersion !== tokenVersion) {
        await redisClient.del(newTokenKey);
        await redisClient.del(`refresh_family:${familyId}`);
        const staleErr = new Error("Session revoked due to password or credential update.");
        staleErr.code = "VERSION_MISMATCH";
        throw staleErr;
    }

    // Update the replacement token with verified user info
    const finalNewRecord = JSON.stringify({
        userId: user._id.toString(),
        email: user.email,
        familyId,
        tokenVersion: currentTokenVersion,
        createdAt: Date.now()
    });
    await redisClient.set(newTokenKey, finalNewRecord, { EX: REFRESH_TOKEN_TTL_SECONDS });

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
 * F-16 Remediation:
 * Confirms server-side revocation before clearing auth cookies.
 * Does not report success if Redis or revocation checks fail.
 */
export const clearAuthCookies = async (req, res) => {
    // If Redis is not connected / closed, server-side revocation cannot be confirmed fail-closed
    if (!redisClient || !redisClient.isOpen) {
        const err = new Error("Session revocation failed: Redis session store is unavailable.");
        err.code = "REVOCATION_UNAVAILABLE";
        throw err;
    }

    let serverRevocationSucceeded = false;

    // 1. Blocklist access token if valid
    if (req.token && req.tokenPayload?.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        const remainingTime = req.tokenPayload.exp - currentTime;
        if (remainingTime > 0) {
            await redisClient.set(`blocklist:${req.token}`, "blocked", { EX: remainingTime });
            serverRevocationSucceeded = true;
        }
    }

    // 2. Revoke refresh token and associated family
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
        const tokenHash = hashRefreshToken(refreshToken);
        const tokenRecordStr = await redisClient.get(`refresh_token:${tokenHash}`);
        if (tokenRecordStr) {
            const tokenRecord = JSON.parse(tokenRecordStr);
            if (tokenRecord.familyId) {
                await redisClient.del(`refresh_family:${tokenRecord.familyId}`);
            }
            await redisClient.del(`refresh_token:${tokenHash}`);
            serverRevocationSucceeded = true;
        }
    }

    // 3. Increment tokenVersion in database if authenticated user exists
    if (req.userId && mongoose.connection?.readyState === 1) {
        try {
            const updated = await User.findByIdAndUpdate(
                req.userId,
                { $inc: { tokenVersion: 1 } },
                { returnDocument: "after" }
            );
            if (updated) {
                await redisClient.set(
                    `user:tokenVersion:${req.userId}`,
                    updated.tokenVersion.toString(),
                    { EX: REFRESH_TOKEN_TTL_SECONDS }
                );
                serverRevocationSucceeded = true;
            }
        } catch (dbErr) {
            console.error("Failed to increment tokenVersion during logout:", dbErr);
        }
    }

    // Clear client cookies
    res.clearCookie("token", REFRESH_COOKIE_OPTS);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTS);

    return true;
};
