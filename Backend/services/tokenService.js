import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { redisClient } from "../config/redis.js";
import User from "../model/userSchema.js";

const JWT_ISSUER = "thunder-ai";
const JWT_AUDIENCE = "thunder-ai-client";

const isProduction = process.env.NODE_ENV === "production";

/**
 * F-23 Remediation:
 * Parses a duration string (e.g. "15m", "900s", "1h", "7d") or integer into seconds.
 */
export const parseDurationToSeconds = (val, fieldName = "TTL") => {
    if (typeof val === "number") {
        if (!Number.isFinite(val) || !Number.isSafeInteger(val) || val <= 0) {
            throw new Error(`Invalid ${fieldName}: must be a positive safe integer.`);
        }
        return val;
    }
    if (typeof val !== "string") {
        throw new Error(`Invalid ${fieldName}: must be a number or duration string.`);
    }
    const trimmed = val.trim();
    if (!trimmed) {
        throw new Error(`Invalid ${fieldName}: cannot be empty.`);
    }
    const match = trimmed.match(/^(\d+)([smhd])?$/i);
    if (!match) {
        throw new Error(`Invalid ${fieldName}: "${val}" is not a valid duration format.`);
    }
    const num = parseInt(match[1], 10);
    if (!Number.isSafeInteger(num) || num <= 0) {
        throw new Error(`Invalid ${fieldName}: must be a positive safe integer.`);
    }
    const unit = (match[2] || "s").toLowerCase();
    switch (unit) {
        case "s": return num;
        case "m": return num * 60;
        case "h": return num * 3600;
        case "d": return num * 86400;
        default: throw new Error(`Invalid ${fieldName} unit: "${unit}".`);
    }
};

/**
 * F-23 Remediation:
 * Validates JWT secret and session TTL configurations against strict security bounds.
 */
export const validateTokenConfig = () => {
    // 1. JWT_SECRET length and entropy policy
    const secret = process.env.JWT_SECRET;
    if (!secret || typeof secret !== "string") {
        throw new Error("Critical configuration failure: JWT_SECRET is required.");
    }
    if (secret.length < 32) {
        throw new Error(`Critical configuration failure: JWT_SECRET length must be at least 32 characters (got ${secret.length}).`);
    }
    const isTrivial = /^(.)\1+$/.test(secret) || /your_jwt_secret|change_this|placeholder|default_jwt/i.test(secret);
    if (isTrivial) {
        throw new Error("Critical configuration failure: JWT_SECRET contains trivial repeated or placeholder pattern.");
    }

    // 2. ACCESS_TOKEN_TTL validation (between 60 seconds and 3600 seconds)
    const accessTtlRaw = process.env.ACCESS_TOKEN_TTL || "15m";
    const accessTtlSec = parseDurationToSeconds(accessTtlRaw, "ACCESS_TOKEN_TTL");
    if (accessTtlSec < 60 || accessTtlSec > 3600) {
        throw new Error(`Critical configuration failure: ACCESS_TOKEN_TTL must be between 60 seconds (1m) and 3600 seconds (1h) (got ${accessTtlSec}s).`);
    }

    // 3. REFRESH_TOKEN_TTL_SECONDS validation (between 3600 seconds [1 hour] and 2592000 seconds [30 days])
    const refreshTtlRaw = process.env.REFRESH_TOKEN_TTL_SECONDS || "604800";
    const refreshTtlSec = parseDurationToSeconds(refreshTtlRaw, "REFRESH_TOKEN_TTL_SECONDS");
    if (refreshTtlSec < 3600 || refreshTtlSec > 2592000) {
        throw new Error(`Critical configuration failure: REFRESH_TOKEN_TTL_SECONDS must be between 3600 (1 hour) and 2592000 (30 days) (got ${refreshTtlSec}s).`);
    }

    return {
        jwtSecret: secret,
        accessTokenTtlSeconds: accessTtlSec,
        accessTokenTtlMs: accessTtlSec * 1000,
        refreshTokenTtlSeconds: refreshTtlSec,
        refreshTokenTtlMs: refreshTtlSec * 1000
    };
};

export const getAccessTokenTTLSeconds = () => {
    try {
        return parseDurationToSeconds(process.env.ACCESS_TOKEN_TTL || "15m", "ACCESS_TOKEN_TTL");
    } catch {
        return 900;
    }
};

export const getAccessTokenTTLMs = () => getAccessTokenTTLSeconds() * 1000;

export const getRefreshTokenTTLSeconds = () => {
    try {
        return parseDurationToSeconds(process.env.REFRESH_TOKEN_TTL_SECONDS || "604800", "REFRESH_TOKEN_TTL_SECONDS");
    } catch {
        return 604800;
    }
};

export const getRefreshTokenTTLMs = () => getRefreshTokenTTLSeconds() * 1000;

/**
 * F-14, F-15 & F-22: Redis Lua script for strictly atomic refresh-token rotation and reuse detection.
 * Enforces Absolute Family Lifetime Policy (F-22):
 * 1. Checks if the presented token hash was already revoked (Reuse Detection).
 * 2. Checks if the active token exists.
 * 3. Inspects the remaining TTL of the family key. If <= 0, family is expired/revoked.
 * 4. Atomically consumes old token (DEL).
 * 5. Atomically registers old token in revoked registry for the FULL family lifetime (F-15).
 * 6. Atomically stores new replacement token capped at the family's remaining TTL (F-22).
 * 7. Returns status, old record payload, and exact remaining family TTL.
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
    return {'REUSE_DETECTED', revoked, '0'}
end

-- 2. Check if active token exists
local current = redis.call('GET', oldTokenKey)
if not current then
    return {'INVALID_TOKEN', '', '0'}
end

-- 3. Parse token data and check remaining family TTL (F-22 Absolute Family Lifetime)
local data = cjson.decode(current)
local familyKey = 'refresh_family:' .. (data.familyId or '')
local remainingTTL = redis.call('TTL', familyKey)
if remainingTTL <= 0 then
    return {'FAMILY_REVOKED', '', '0'}
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

-- 6. Store replacement token capped at the family's remaining TTL (F-22 remediation)
redis.call('SET', newTokenKey, newTokenVal, 'EX', remainingTTL)

return {'OK', current, tostring(remainingTTL)}
`;

/**
 * Generates standard short-lived Access Token
 * Standard claims: sub, id, email, role, tokenVersion, iss, aud, exp
 */
export const generateAccessToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT Secret key is missing in environment");
    }

    const userId = (user._id || user.id || user.sub).toString();
    const tokenVersion = typeof user.tokenVersion === "number" ? user.tokenVersion : 0;
    const ttlSeconds = getAccessTokenTTLSeconds();

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
            expiresIn: ttlSeconds,
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

    const refreshTtlSec = getRefreshTokenTTLSeconds();
    const tokenHash = hashRefreshToken(refreshToken);
    const record = JSON.stringify({
        userId: userId.toString(),
        email,
        familyId,
        tokenVersion: typeof tokenVersion === "number" ? tokenVersion : 0,
        createdAt: Date.now()
    });

    await redisClient.set(`refresh_token:${tokenHash}`, record, { EX: refreshTtlSec });
    await redisClient.set(`refresh_family:${familyId}`, "active", { EX: refreshTtlSec });
};

/**
 * F-14, F-15, F-19 & F-22 Remediation:
 * Atomically rotates a refresh token using a Redis Lua script, enforcing atomic token
 * swap, full-lifetime reuse retention, authoritative database verification, and absolute family lifetime.
 */
export const rotateRefreshToken = async (oldRefreshToken) => {
    if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis connection required for token rotation");
    }

    // F-19: Mandatory Authoritative Database Connection - Fail closed if MongoDB is offline
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        const dbErr = new Error("Authentication service temporarily unavailable: database offline.");
        dbErr.code = "SERVICE_UNAVAILABLE";
        throw dbErr;
    }

    const oldHash = hashRefreshToken(oldRefreshToken);
    const newRefreshToken = generateRefreshToken();
    const newHash = hashRefreshToken(newRefreshToken);

    const revokedKey = `refresh_revoked:${oldHash}`;
    const oldTokenKey = `refresh_token:${oldHash}`;
    const newTokenKey = `refresh_token:${newHash}`;

    const nowStr = Date.now().toString();
    const refreshTtlSec = getRefreshTokenTTLSeconds();

    const provisionalRecord = JSON.stringify({
        newHash,
        rotatedAt: nowStr
    });

    // Execute atomic rotation Lua script
    const result = await redisClient.eval(ATOMIC_ROTATION_LUA, {
        keys: [revokedKey, oldTokenKey, newTokenKey],
        arguments: [provisionalRecord, refreshTtlSec.toString(), nowStr]
    });

    const status = result[0];
    const payload = result[1];
    const remainingTTL = parseInt(result[2] || "0", 10);

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
                    await redisClient.del(`user:tokenVersion:${userId}`);
                    await redisClient.set(
                        `user:tokenVersion:${userId}`,
                        user.tokenVersion.toString(),
                        { EX: refreshTtlSec }
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

    // F-19 Remediation: Authoritative database check (synthetic user fallback removed)
    const user = await User.findById(userId);
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

    // Update the replacement token with verified user info using remaining family TTL
    const finalNewRecord = JSON.stringify({
        userId: user._id.toString(),
        email: user.email,
        familyId,
        tokenVersion: currentTokenVersion,
        createdAt: Date.now()
    });
    await redisClient.set(newTokenKey, finalNewRecord, { EX: remainingTTL });

    const newAccessToken = generateAccessToken(user);

    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user,
        remainingTTL
    };
};

/**
 * Cookie configuration policies
 * F-23: Dynamically derives maxAge from validated ACCESS_TOKEN_TTL.
 */
export const getAccessTokenCookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: getAccessTokenTTLMs()
});

/**
 * F-22: Allows capping refreshToken cookie maxAge at the family's remaining TTL.
 */
export const getRefreshTokenCookieOptions = (maxAgeMs = null) => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: typeof maxAgeMs === "number" && maxAgeMs > 0 ? maxAgeMs : getRefreshTokenTTLMs()
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
 * F-16 & F-21 Remediation:
 * Confirms server-side revocation before clearing auth cookies.
 * Does not report success if Redis or cross-device revocation fails.
 */
export const clearAuthCookies = async (req, res) => {
    // If Redis is not connected / closed, server-side revocation cannot be confirmed fail-closed
    if (!redisClient || !redisClient.isOpen) {
        const err = new Error("Session revocation failed: Redis session store is unavailable.");
        err.code = "REVOCATION_UNAVAILABLE";
        throw err;
    }

    // 1. Blocklist access token if valid
    if (req.token && req.tokenPayload?.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        const remainingTime = req.tokenPayload.exp - currentTime;
        if (remainingTime > 0) {
            await redisClient.set(`blocklist:${req.token}`, "blocked", { EX: remainingTime });
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
        }
    }

    // 3. F-21 Remediation: Global cross-device revocation
    // If authenticated user is present, increment tokenVersion in database and sync cache.
    // If database or cache update fails, fail closed with REVOCATION_FAILED.
    if (req.userId) {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            const dbErr = new Error("Database unavailable for session revocation.");
            dbErr.code = "REVOCATION_FAILED";
            throw dbErr;
        }

        try {
            const updated = await User.findByIdAndUpdate(
                req.userId,
                { $inc: { tokenVersion: 1 } },
                { returnDocument: "after" }
            );
            if (!updated) {
                const notFoundErr = new Error("User account not found for session revocation.");
                notFoundErr.code = "REVOCATION_FAILED";
                throw notFoundErr;
            }

            // Invalidate old cache and set new version in Redis
            await redisClient.del(`user:tokenVersion:${req.userId}`);
            await redisClient.set(
                `user:tokenVersion:${req.userId}`,
                updated.tokenVersion.toString(),
                { EX: getRefreshTokenTTLSeconds() }
            );
        } catch (err) {
            const failErr = new Error(`Server-side session revocation failed: ${err.message}`);
            failErr.code = "REVOCATION_FAILED";
            throw failErr;
        }
    }

    // Clear client cookies only when server revocation actions succeeded
    res.clearCookie("token", REFRESH_COOKIE_OPTS);
    res.clearCookie("refreshToken", REFRESH_COOKIE_OPTS);

    return true;
};
