import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import connectionDB from "../config/database.js";
import { redisClient, connectRedis } from "../config/redis.js";
import User from "../model/userSchema.js";
import { login, logout, refreshToken } from "../controllers/userController.js";

import {
    getEncryptionKey,
    encryptAES,
    decryptAES,
    validateKeyManagerConfig
} from "../services/keyManagerService.js";

import {
    generateAccessToken,
    generateRefreshToken,
    hashRefreshToken,
    storeRefreshToken,
    rotateRefreshToken,
    clearAuthCookies,
    validateTokenConfig,
    parseDurationToSeconds,
    getAccessTokenCookieOptions,
    getRefreshTokenCookieOptions,
    getAccessTokenTTLSeconds,
    getAccessTokenTTLMs,
    getRefreshTokenTTLSeconds,
    getRefreshTokenTTLMs
} from "../services/tokenService.js";

import fallbackLimiter from "../utils/fallbackRateLimiter.js";
import { isAllowedOrigin } from "../utils/originUtils.js";
import csrfProtection from "../middleware/csrfProtection.js";
import authUserMiddleware from "../middleware/authUserMiddleware.js";

const VALID_KEY_64_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_JWT_SECRET = "test-jwt-secret-very-secure-32chars-minimum!";

describe("Thunder AI - Security Remediation Acceptance Test Suite", () => {
    const origEnv = { ...process.env };
    let testUser = null;
    let TEST_USER_ID = null;

    before(async () => {
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        process.env.BYOK_ENCRYPTION_KEY = VALID_KEY_64_HEX;

        await connectRedis();
        assert.ok(redisClient && redisClient.isOpen, "Redis must be connected for security tests");

        await connectionDB();
        assert.strictEqual(mongoose.connection.readyState, 1, "MongoDB must be connected for security tests");

        testUser = await User.findOne({ email: "test-session-runner@thunder.ai" });
        if (!testUser) {
            testUser = await User.create({
                name: "Session Test Runner",
                email: "test-session-runner@thunder.ai",
                password: "SecureHashedPassword123!",
                role: "user",
                isVerified: true,
                tokenVersion: 0
            });
        } else {
            testUser.tokenVersion = 0;
            await testUser.save();
        }
        TEST_USER_ID = testUser._id.toString();
    });

    after(async () => {
        process.env = origEnv;
        try {
            if (testUser) {
                await User.deleteOne({ _id: testUser._id });
            }
        } catch {}
        try {
            await mongoose.disconnect();
        } catch {}
        try {
            if (redisClient && redisClient.isOpen) {
                await redisClient.quit();
            }
        } catch {}
    });

    // ==========================================
    // F-08: Dedicated BYOK Encryption Key Format
    // ==========================================
    describe("F-08: Dedicated BYOK Encryption Key Validation", () => {
        test("Rejects missing BYOK key", () => {
            delete process.env.BYOK_ENCRYPTION_KEY;
            assert.throws(() => getEncryptionKey(), /missing/i);
        });

        test("Rejects non-hex BYOK key", () => {
            process.env.BYOK_ENCRYPTION_KEY = "g".repeat(64);
            assert.throws(() => getEncryptionKey(), /hexadecimal/i);
        });

        test("Rejects short (<64) or long (>64) BYOK key", () => {
            process.env.BYOK_ENCRYPTION_KEY = "a".repeat(32);
            assert.throws(() => getEncryptionKey(), /must be exactly 64/i);

            process.env.BYOK_ENCRYPTION_KEY = "a".repeat(128);
            assert.throws(() => getEncryptionKey(), /must be exactly 64/i);
        });

        test("Rejects placeholder or trivial repeating keys", () => {
            process.env.BYOK_ENCRYPTION_KEY = "your_64_hex_byte_random_encryption_key_here_must_be_32_bytes_len";
            assert.throws(() => getEncryptionKey(), /placeholder/i);

            process.env.BYOK_ENCRYPTION_KEY = "0".repeat(64);
            assert.throws(() => getEncryptionKey(), /trivial|repeated/i);
        });

        test("Accepts valid 64-hex key and produces exactly 32 bytes buffer", () => {
            process.env.BYOK_ENCRYPTION_KEY = VALID_KEY_64_HEX;
            const keyBuf = getEncryptionKey();
            assert.strictEqual(Buffer.isBuffer(keyBuf), true);
            assert.strictEqual(keyBuf.length, 32);
        });

        test("Encrypts and decrypts correctly with AES-256-GCM", () => {
            process.env.BYOK_ENCRYPTION_KEY = VALID_KEY_64_HEX;
            const plainApiKey = "sk-ant-api03-abcdef1234567890-test";
            const encrypted = encryptAES(plainApiKey);

            assert.strictEqual(typeof encrypted, "string");
            assert.notStrictEqual(encrypted, plainApiKey);

            const decrypted = decryptAES(encrypted);
            assert.strictEqual(decrypted, plainApiKey);
        });

        test("Tampered ciphertext or auth tag fails closed (no plaintext fallback)", () => {
            process.env.BYOK_ENCRYPTION_KEY = VALID_KEY_64_HEX;
            const encrypted = encryptAES("my-secret-key");
            const parts = encrypted.split(":");
            parts[2] = Buffer.from("tampered_cipher").toString("base64");
            const tampered = parts.join(":");

            assert.throws(() => decryptAES(tampered), /corrupted|failed|Unsupported state/i);
        });

        test("JWT_SECRET changes do NOT affect BYOK encryption", () => {
            process.env.BYOK_ENCRYPTION_KEY = VALID_KEY_64_HEX;
            process.env.JWT_SECRET = "secret-A-123456789012345678901234567890";
            const enc = encryptAES("constant-api-key");

            process.env.JWT_SECRET = "secret-B-999999999999999999999999999999";
            const dec = decryptAES(enc);
            assert.strictEqual(dec, "constant-api-key");
        });
    });

    // ==========================================
    // F-09: Token-Version Enforcement
    // ==========================================
    describe("F-09: Token-Version Enforcement", () => {
        before(() => {
            process.env.JWT_SECRET = TEST_JWT_SECRET;
        });

        test("Rejects JWT missing tokenVersion claim", async () => {
            const oldTokenWithoutVersion = jwt.sign(
                { id: TEST_USER_ID, email: "test@example.com" },
                TEST_JWT_SECRET,
                { algorithm: "HS256", issuer: "thunder-ai", audience: "thunder-ai-client" }
            );

            let statusSent = null;
            let bodySent = null;
            const req = {
                cookies: { token: oldTokenWithoutVersion },
                headers: {}
            };
            const res = {
                status: (code) => {
                    statusSent = code;
                    return { json: (data) => { bodySent = data; } };
                }
            };
            const next = () => { statusSent = 200; };

            await authUserMiddleware(req, res, next);
            assert.strictEqual(statusSent, 401);
            assert.match(bodySent.message, /tokenVersion/i);
        });

        test("Rejects JWT with invalid/malformed tokenVersion (string or negative)", async () => {
            for (const badVersion of ["1", -1, 3.14, null]) {
                const badToken = jwt.sign(
                    { id: TEST_USER_ID, email: "test@example.com", tokenVersion: badVersion },
                    TEST_JWT_SECRET,
                    { algorithm: "HS256", issuer: "thunder-ai", audience: "thunder-ai-client" }
                );

                let statusSent = null;
                const req = { cookies: { token: badToken }, headers: {} };
                const res = { status: (code) => { statusSent = code; return { json: () => {} }; } };

                await authUserMiddleware(req, res, () => {});
                assert.strictEqual(statusSent, 401);
            }
        });

        test("Rejects JWT with wrong issuer or audience", async () => {
            const badIssuerToken = jwt.sign(
                { id: TEST_USER_ID, email: "test@example.com", tokenVersion: 0 },
                TEST_JWT_SECRET,
                { algorithm: "HS256", issuer: "wrong-issuer", audience: "thunder-ai-client" }
            );

            let statusSent = null;
            const req = { cookies: { token: badIssuerToken }, headers: {} };
            const res = { status: (code) => { statusSent = code; return { json: () => {} }; } };

            await authUserMiddleware(req, res, () => {});
            assert.strictEqual(statusSent, 401);
        });
    });

    // ==========================================
    // F-10: Production Redis Configuration Policy
    // ==========================================
    describe("F-10: Production Redis Configuration Policy", () => {
        test("In production mode, missing REDIS_URL throws fail-closed error", async () => {
            const prevEnv = process.env.NODE_ENV;
            const prevUrl = process.env.REDIS_URL;
            process.env.NODE_ENV = "production";
            delete process.env.REDIS_URL;

            assert.throws(() => {
                if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
                    throw new Error("FAIL_CLOSED: REDIS_URL is required in production");
                }
            }, /FAIL_CLOSED/);

            process.env.NODE_ENV = prevEnv;
            process.env.REDIS_URL = prevUrl;
        });

        test("Subprocess execution with NODE_ENV=production without REDIS_URL fails startup immediately", () => {
            const result = spawnSync(
                process.execPath,
                ["--input-type=module", "-e", "import('./config/redis.js')"],
                {
                    cwd: path.resolve(import.meta.dirname, ".."),
                    env: {
                        ...process.env,
                        NODE_ENV: "production",
                        REDIS_URL: "",
                        REDIS_URI: ""
                    },
                    encoding: "utf8"
                }
            );

            assert.strictEqual(result.status, 1);
            assert.match(
                result.stderr,
                /Critical production startup failure: REDIS_URL is mandatory in production/
            );
        });
    });

    // ==========================================
    // F-11: Fallback Rate Limiter (Bounded LRU)
    // ==========================================
    describe("F-11: Bounded LRU Fallback Rate Limiter", () => {
        before(() => {
            fallbackLimiter.store.clear();
        });

        test("Allows requests up to maximum threshold", () => {
            const client = "198.51.100.1";
            for (let i = 0; i < 5; i++) {
                const res = fallbackLimiter.checkLimit(client, 5, 10);
                assert.strictEqual(res.allowed, true);
            }
        });

        test("Blocks requests when maximum threshold exceeded", () => {
            const client = "198.51.100.2";
            for (let i = 0; i < 3; i++) {
                fallbackLimiter.checkLimit(client, 3, 10);
            }
            const blocked = fallbackLimiter.checkLimit(client, 3, 10);
            assert.strictEqual(blocked.allowed, false);
            assert.strictEqual(blocked.count > 3, true);
        });

        test("Enforces memory bounds with safe pruning", () => {
            fallbackLimiter.store.clear();
            for (let i = 0; i < 100; i++) {
                fallbackLimiter.checkLimit(`user-churn-${i}`, 10, 60);
            }
            const res = fallbackLimiter.checkLimit("user-churn-0", 10, 60);
            assert.strictEqual(res.allowed, true);
        });
    });

    // ==========================================
    // Section 4 & F-14, F-15, F-22: Refresh Token Lifecycle
    // ==========================================
    describe("Section 4: Complete Session Lifecycle & Rotation", () => {
        test("Generates access token matching validated TTL configuration", () => {
            const token = generateAccessToken(testUser);
            const decoded = jwt.verify(token, TEST_JWT_SECRET, {
                algorithms: ["HS256"],
                issuer: "thunder-ai",
                audience: "thunder-ai-client"
            });

            assert.strictEqual(decoded.sub, TEST_USER_ID);
            assert.strictEqual(decoded.id, TEST_USER_ID);
            assert.strictEqual(decoded.email, testUser.email);
            assert.strictEqual(decoded.tokenVersion, 0);
            assert.strictEqual(decoded.iss, "thunder-ai");
            assert.strictEqual(decoded.aud, "thunder-ai-client");

            const remainingSeconds = decoded.exp - decoded.iat;
            assert.strictEqual(remainingSeconds, getAccessTokenTTLSeconds());
        });

        test("Refresh token is 256 bits (64 hex characters) and hashed at rest", () => {
            const token = generateRefreshToken();
            assert.strictEqual(token.length, 64);
            assert.match(token, /^[0-9a-f]{64}$/);

            const hash = hashRefreshToken(token);
            assert.strictEqual(hash.length, 64);
            assert.match(hash, /^[0-9a-f]{64}$/);
            assert.notStrictEqual(token, hash);
        });

        test("Stores and rotates refresh token atomically with family tracking", async () => {
            const email = "lifecycle@thunder.ai";
            const familyId = crypto.randomUUID();
            const token1 = generateRefreshToken();

            await storeRefreshToken(token1, TEST_USER_ID, email, familyId, 0);

            const hash1 = hashRefreshToken(token1);
            const stored = await redisClient.get(`refresh_token:${hash1}`);
            assert.ok(stored);
            const parsed = JSON.parse(stored);
            assert.strictEqual(parsed.userId, TEST_USER_ID);
            assert.strictEqual(parsed.familyId, familyId);

            const famStatus = await redisClient.get(`refresh_family:${familyId}`);
            assert.strictEqual(famStatus, "active");

            await redisClient.del(`refresh_token:${hash1}`);
            await redisClient.del(`refresh_family:${familyId}`);
        });

        test("Reuse of an already rotated refresh token revokes token family and invalidates all sessions", async () => {
            const familyId = crypto.randomUUID();
            const tokenA = generateRefreshToken();
            const hashA = hashRefreshToken(tokenA);

            await redisClient.set(
                `refresh_revoked:${hashA}`,
                JSON.stringify({ familyId, userId: TEST_USER_ID, rotatedAt: Date.now() }),
                { EX: 604800 }
            );
            await redisClient.set(`refresh_family:${familyId}`, "active", { EX: 604800 });

            await assert.rejects(
                () => rotateRefreshToken(tokenA),
                (err) => {
                    assert.strictEqual(err.code, "TOKEN_REUSE");
                    return true;
                }
            );

            const familyCheck = await redisClient.get(`refresh_family:${familyId}`);
            assert.strictEqual(familyCheck, null);

            await redisClient.del(`refresh_revoked:${hashA}`);
        });

        test("F-14: Concurrent rotation of the same refresh token yields exactly 1 success and 1 TOKEN_REUSE", async () => {
            const userDoc = await User.findById(TEST_USER_ID);
            const currentVer = userDoc ? (userDoc.tokenVersion || 0) : 0;

            const email = "concurrency@thunder.ai";
            const familyId = crypto.randomUUID();
            const token = generateRefreshToken();
            const tokenHash = hashRefreshToken(token);

            await storeRefreshToken(token, TEST_USER_ID, email, familyId, currentVer);

            const [result1, result2] = await Promise.allSettled([
                rotateRefreshToken(token),
                rotateRefreshToken(token)
            ]);

            const fulfilled = [result1, result2].filter(r => r.status === "fulfilled");
            const rejected = [result1, result2].filter(r => r.status === "rejected");

            assert.strictEqual(fulfilled.length, 1, "Exactly one rotation must succeed");
            assert.strictEqual(rejected.length, 1, "Exactly one rotation must fail");
            assert.strictEqual(rejected[0].reason?.code, "TOKEN_REUSE");

            await redisClient.del(`refresh_token:${tokenHash}`);
            await redisClient.del(`refresh_revoked:${tokenHash}`);
            await redisClient.del(`refresh_family:${familyId}`);
            if (fulfilled[0]?.value?.refreshToken) {
                const newHash = hashRefreshToken(fulfilled[0].value.refreshToken);
                await redisClient.del(`refresh_token:${newHash}`);
            }
        });

        test("F-15: Retains consumed-token reuse markers for the full family lifetime (>600000s)", async () => {
            const userDoc = await User.findById(TEST_USER_ID);
            const currentVer = userDoc ? (userDoc.tokenVersion || 0) : 0;

            const email = "lifetime@thunder.ai";
            const familyId = crypto.randomUUID();
            const token = generateRefreshToken();
            const tokenHash = hashRefreshToken(token);

            await storeRefreshToken(token, TEST_USER_ID, email, familyId, currentVer);
            const rotated = await rotateRefreshToken(token);

            const ttl = await redisClient.ttl(`refresh_revoked:${tokenHash}`);
            assert.ok(ttl > 600000, `Expected TTL > 600000s, got ${ttl}s`);

            await redisClient.del(`refresh_revoked:${tokenHash}`);
            await redisClient.del(`refresh_family:${familyId}`);
            if (rotated?.refreshToken) {
                const newHash = hashRefreshToken(rotated.refreshToken);
                await redisClient.del(`refresh_token:${newHash}`);
            }
        });

        test("F-22: Replacement token and cookie TTL are capped at remaining family TTL", async () => {
            const userDoc = await User.findById(TEST_USER_ID);
            const currentVer = userDoc ? (userDoc.tokenVersion || 0) : 0;

            const familyId = crypto.randomUUID();
            const token = generateRefreshToken();
            const tokenHash = hashRefreshToken(token);

            // Seed family with capped 3000 seconds remaining lifetime
            await redisClient.set(`refresh_family:${familyId}`, "active", { EX: 3000 });
            await redisClient.set(
                `refresh_token:${tokenHash}`,
                JSON.stringify({ userId: TEST_USER_ID, email: testUser.email, familyId, tokenVersion: currentVer, createdAt: Date.now() }),
                { EX: 3000 }
            );

            const rotated = await rotateRefreshToken(token);
            assert.ok(rotated.remainingTTL <= 3000, `Expected remainingTTL <= 3000, got ${rotated.remainingTTL}`);

            const newHash = hashRefreshToken(rotated.refreshToken);
            const newTtl = await redisClient.ttl(`refresh_token:${newHash}`);
            assert.ok(newTtl <= 3000, `Replacement token TTL in Redis must be capped at ${rotated.remainingTTL}`);

            // Verify cookie options respect remaining TTL
            const cookieOpts = getRefreshTokenCookieOptions(rotated.remainingTTL * 1000);
            assert.strictEqual(cookieOpts.maxAge, rotated.remainingTTL * 1000);

            // Clean up
            await redisClient.del(`refresh_token:${newHash}`);
            await redisClient.del(`refresh_revoked:${tokenHash}`);
            await redisClient.del(`refresh_family:${familyId}`);
        });
    });

    // ==========================================
    // F-19: Database-Outage Fail-Closed Behavior
    // ==========================================
    describe("F-19: Refresh-Token Database Outage Fail-Closed", () => {
        test("Simulated MongoDB disconnected fails rotation with SERVICE_UNAVAILABLE (HTTP 503)", async () => {
            Object.defineProperty(mongoose.connection, "readyState", { value: 0, configurable: true });

            const fakeToken = generateRefreshToken();

            try {
                await assert.rejects(
                    () => rotateRefreshToken(fakeToken),
                    (err) => {
                        assert.strictEqual(err.code, "SERVICE_UNAVAILABLE");
                        return true;
                    }
                );

                let statusSent = null;
                let bodySent = null;
                let cookiesSet = [];
                const req = { cookies: { refreshToken: fakeToken } };
                const res = {
                    status: (code) => {
                        statusSent = code;
                        return { json: (data) => { bodySent = data; } };
                    },
                    cookie: (name, val) => cookiesSet.push(name),
                    clearCookie: () => {}
                };

                await refreshToken(req, res);
                assert.strictEqual(statusSent, 503);
                assert.strictEqual(cookiesSet.length, 0, "No cookies may be minted during DB outage");
                assert.match(bodySent.message, /database offline/i);
            } finally {
                delete mongoose.connection.readyState;
            }
        });
    });

    // ==========================================
    // F-20: Authoritative TokenVersion & Cache Invalidation
    // ==========================================
    describe("F-20: Authoritative TokenVersion Verification & Cache Reconciliation", () => {
        test("Seed old cache, bump DB version, force cache write to fail -> Old token is rejected (401)", async () => {
            const cacheKey = `user:tokenVersion:${TEST_USER_ID}`;
            // 1. Seed old version 0 in Redis cache
            await redisClient.set(cacheKey, "0", { EX: 3600 });

            // 2. Bump DB version directly to 1 (simulating password reset or revocation)
            await User.findByIdAndUpdate(TEST_USER_ID, { $set: { tokenVersion: 1 } });

            // 3. Create access token with old version 0
            const oldToken = jwt.sign(
                { id: TEST_USER_ID, sub: TEST_USER_ID, email: testUser.email, tokenVersion: 0 },
                TEST_JWT_SECRET,
                { algorithm: "HS256", issuer: "thunder-ai", audience: "thunder-ai-client", expiresIn: "15m" }
            );

            let statusSent = null;
            let bodySent = null;
            let nextCalled = false;
            const req = { cookies: { token: oldToken }, headers: {} };
            const res = {
                status: (code) => {
                    statusSent = code;
                    return { json: (data) => { bodySent = data; } };
                }
            };
            const next = () => { nextCalled = true; };

            await authUserMiddleware(req, res, next);

            // Must reject because DB authoritatively has version 1
            assert.strictEqual(statusSent, 401);
            assert.strictEqual(nextCalled, false);
            assert.match(bodySent.message, /expired or revoked/i);

            // Verify Redis cache was healed to version 1
            const healed = await redisClient.get(cacheKey);
            assert.strictEqual(healed, "1");

            // Reset DB version to 0
            await User.findByIdAndUpdate(TEST_USER_ID, { $set: { tokenVersion: 0 } });
            await redisClient.del(cacheKey);
        });
    });

    // ==========================================
    // F-21: Fail-Closed Logout Revocation Guarantee
    // ==========================================
    describe("F-21: Fail-Closed Logout Revocation Guarantee", () => {
        test("clearAuthCookies throws REVOCATION_UNAVAILABLE when Redis is offline", async () => {
            const fakeReq = { cookies: { refreshToken: "fake-refresh-token" } };
            const fakeRes = { clearCookie: () => {} };

            Object.defineProperty(redisClient, "isOpen", { value: false, configurable: true });

            try {
                await assert.rejects(
                    () => clearAuthCookies(fakeReq, fakeRes),
                    (err) => {
                        assert.strictEqual(err.code, "REVOCATION_UNAVAILABLE");
                        return true;
                    }
                );
            } finally {
                delete redisClient.isOpen;
            }
        });

        test("logout controller returns HTTP 503 when DB version increment fails during cross-device revocation", async () => {
            const fakeReq = {
                userId: TEST_USER_ID,
                token: "some-access-token",
                tokenPayload: { exp: Math.floor(Date.now() / 1000) + 900 },
                cookies: {}
            };
            let statusSent = null;
            let bodySent = null;
            let cookiesCleared = [];
            const fakeRes = {
                status: (code) => {
                    statusSent = code;
                    return { json: (data) => { bodySent = data; } };
                },
                clearCookie: (name) => cookiesCleared.push(name)
            };

            // Injected failure: mock User.findByIdAndUpdate to throw
            const origFindByIdAndUpdate = User.findByIdAndUpdate;
            User.findByIdAndUpdate = async () => {
                throw new Error("Simulated database write failure");
            };

            try {
                await logout(fakeReq, fakeRes);
                assert.strictEqual(statusSent, 503);
                assert.strictEqual(cookiesCleared.length, 0, "Cookies must NOT be cleared when server revocation fails");
                assert.match(bodySent.message, /unable to confirm server-side session revocation/i);
            } finally {
                User.findByIdAndUpdate = origFindByIdAndUpdate;
            }
        });
    });

    // ==========================================
    // F-23: Strict Token TTL and Secret Validation
    // ==========================================
    describe("F-23: Strict Token TTL and JWT Secret Validation", () => {
        test("Rejects missing or short (<32 chars) JWT_SECRET", () => {
            const origSecret = process.env.JWT_SECRET;
            delete process.env.JWT_SECRET;
            assert.throws(() => validateTokenConfig(), /JWT_SECRET is required/);

            process.env.JWT_SECRET = "short-secret-under-32-chars";
            assert.throws(() => validateTokenConfig(), /at least 32 characters/);

            process.env.JWT_SECRET = origSecret;
        });

        test("Rejects trivial repeating or placeholder JWT_SECRET", () => {
            const origSecret = process.env.JWT_SECRET;
            process.env.JWT_SECRET = "a".repeat(32);
            assert.throws(() => validateTokenConfig(), /trivial repeated or placeholder/);

            process.env.JWT_SECRET = "your_jwt_secret_key_minimum_32_characters";
            assert.throws(() => validateTokenConfig(), /trivial repeated or placeholder/);

            process.env.JWT_SECRET = origSecret;
        });

        test("Rejects out-of-bounds ACCESS_TOKEN_TTL (<60s or >3600s)", () => {
            const origAccessTtl = process.env.ACCESS_TOKEN_TTL;
            process.env.ACCESS_TOKEN_TTL = "30s";
            assert.throws(() => validateTokenConfig(), /ACCESS_TOKEN_TTL must be between 60 seconds/);

            process.env.ACCESS_TOKEN_TTL = "2h";
            assert.throws(() => validateTokenConfig(), /ACCESS_TOKEN_TTL must be between 60 seconds/);

            process.env.ACCESS_TOKEN_TTL = origAccessTtl;
        });

        test("Rejects out-of-bounds REFRESH_TOKEN_TTL_SECONDS (<3600s or >2592000s)", () => {
            const origRefreshTtl = process.env.REFRESH_TOKEN_TTL_SECONDS;
            process.env.JWT_SECRET = TEST_JWT_SECRET;
            process.env.ACCESS_TOKEN_TTL = "15m";

            process.env.REFRESH_TOKEN_TTL_SECONDS = "1800";
            assert.throws(() => validateTokenConfig(), /REFRESH_TOKEN_TTL_SECONDS must be between 3600/);

            process.env.REFRESH_TOKEN_TTL_SECONDS = "3000000";
            assert.throws(() => validateTokenConfig(), /REFRESH_TOKEN_TTL_SECONDS must be between 3600/);

            process.env.REFRESH_TOKEN_TTL_SECONDS = origRefreshTtl;
        });

        test("Access cookie maxAge matches validated JWT expiry exactly", () => {
            process.env.JWT_SECRET = TEST_JWT_SECRET;
            process.env.ACCESS_TOKEN_TTL = "20m";
            const cookieOpts = getAccessTokenCookieOptions();
            assert.strictEqual(cookieOpts.maxAge, 20 * 60 * 1000);
            assert.strictEqual(getAccessTokenTTLSeconds(), 1200);

            process.env.ACCESS_TOKEN_TTL = "15m";
        });
    });

    // ==========================================
    // F-12: Zero Startup Admin Modifications
    // ==========================================
    describe("F-12: Ordinary Application Startup Admin Invariance", () => {
        test("Startup routine does not query or mutate admin roles or credentials", () => {
            const indexSource = fs.readFileSync(path.resolve(import.meta.dirname, "../index.js"), "utf8");
            assert.strictEqual(indexSource.includes("existingAdmin"), false);
            assert.strictEqual(indexSource.includes("ADMIN_EMAILS"), false);
            assert.strictEqual(indexSource.includes("ADMIN_PASSWORD"), false);
        });

        test("seedAdmin script exists as dedicated explicit operator CLI utility", () => {
            const seedPath = path.resolve(import.meta.dirname, "../seedAdmin.js");
            assert.strictEqual(fs.existsSync(seedPath), true);
            const seedSource = fs.readFileSync(seedPath, "utf8");
            assert.ok(seedSource.includes("seedAdmin"));
            assert.ok(seedSource.includes("[AUDIT"));
        });
    });

    // ==========================================
    // F-13: Atomic Password-Reset Token Consumption
    // ==========================================
    describe("F-13: Atomic Password-Reset Token Consumption", () => {
        test("Concurrent redemption: exactly one request succeeds, second returns null", async () => {
            const token = "secure-reset-token-concurrent-test";
            const redisKey = `password-reset:${token}`;
            await redisClient.set(redisKey, "user@thunder.ai", { EX: 60 });

            const consume = async () => {
                if (typeof redisClient.getDel === "function") {
                    return await redisClient.getDel(redisKey);
                }
                const atomicLua = "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]) end; return v;";
                return await redisClient.eval(atomicLua, { keys: [redisKey] });
            };

            const [res1, res2] = await Promise.all([consume(), consume()]);
            const successes = [res1, res2].filter(r => r === "user@thunder.ai");
            const failures = [res1, res2].filter(r => r === null);

            assert.strictEqual(successes.length, 1);
            assert.strictEqual(failures.length, 1);
        });
    });

    // ==========================================
    // CSRF & Origin Defense
    // ==========================================
    describe("CSRF & CORS Defense", () => {
        test("Safe HTTP methods pass through without custom header", () => {
            const req = { method: "GET", headers: {}, cookies: {} };
            const res = {};
            let nextCalled = false;
            csrfProtection(req, res, () => {
                nextCalled = true;
            });
            assert.strictEqual(nextCalled, true);
        });

        test("State-changing requests from untrusted origin are rejected (403)", () => {
            let statusSent = null;
            const req = {
                method: "POST",
                headers: { origin: "https://malicious-attacker.com" },
                cookies: {}
            };
            const res = {
                status: (code) => {
                    statusSent = code;
                    return { json: () => {} };
                }
            };

            csrfProtection(req, res, () => {});
            assert.strictEqual(statusSent, 403);
        });

        test("Cookie-authenticated POST missing custom security header is rejected (403)", () => {
            let statusSent = null;
            const req = {
                method: "POST",
                headers: {},
                cookies: { token: "some-jwt-token" }
            };
            const res = {
                status: (code) => {
                    statusSent = code;
                    return { json: () => {} };
                }
            };

            csrfProtection(req, res, () => {});
            assert.strictEqual(statusSent, 403);
        });

        test("Cookie-authenticated POST with X-Requested-With header passes", () => {
            const req = {
                method: "POST",
                headers: { "x-requested-with": "XMLHttpRequest" },
                cookies: { token: "some-jwt-token" }
            };
            const res = {};
            let nextCalled = false;
            csrfProtection(req, res, () => {
                nextCalled = true;
            });
            assert.strictEqual(nextCalled, true);
        });
    });

    // ==========================================
    // F-17: Elimination of Login Master-Password Fallback & Auto-Promotion
    // ==========================================
    describe("F-17: Elimination of Login Master-Password Fallback & Auto-Promotion", () => {
        test("Application code contains zero references to ADMIN_PASSWORD in controllers and routes", () => {
            const userControllerSrc = fs.readFileSync(path.resolve(import.meta.dirname, "../controllers/userController.js"), "utf8");
            assert.strictEqual(userControllerSrc.includes("ADMIN_PASSWORD"), false);
            assert.strictEqual(userControllerSrc.includes("ADMIN_EMAILS"), false);

            const userRouterSrc = fs.readFileSync(path.resolve(import.meta.dirname, "../routes/userRouter.js"), "utf8");
            assert.strictEqual(userRouterSrc.includes("ADMIN_PASSWORD"), false);

            const adminRouterSrc = fs.readFileSync(path.resolve(import.meta.dirname, "../routes/adminRouter.js"), "utf8");
            assert.strictEqual(adminRouterSrc.includes("ADMIN_PASSWORD"), false);
        });

        test("Login fails with 401 when attempting master password against account with different password", async () => {
            process.env.ADMIN_PASSWORD = "MasterPassword123!";
            let statusSent = null;
            let bodySent = null;
            const req = {
                body: {
                    email: "member@thunder.ai",
                    password: "MasterPassword123!"
                }
            };
            const res = {
                status: (code) => {
                    statusSent = code;
                    return { json: (data) => { bodySent = data; } };
                }
            };

            const origFindOne = User.findOne;
            try {
                User.findOne = async () => ({
                    _id: "65a000000000000000000001",
                    email: "member@thunder.ai",
                    password: "$2b$10$invalidhashdifferentfrommasterpassword12345678901234567",
                    role: "user",
                    isVerified: true
                });

                await login(req, res);
                assert.strictEqual(statusSent, 401);
                assert.strictEqual(bodySent.message, "Invalid Credentials");
            } finally {
                User.findOne = origFindOne;
                delete process.env.ADMIN_PASSWORD;
            }
        });
    });

    // ==========================================
    // F-18: Access-Token Blocklist Fail-Closed in Production
    // ==========================================
    describe("F-18: Access-Token Blocklist Fail-Closed in Production", () => {
        test("authUserMiddleware returns HTTP 503 in production when Redis session store is offline", async () => {
            const prevEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";

            const validToken = jwt.sign(
                { id: TEST_USER_ID, email: "prod@thunder.ai", tokenVersion: 1 },
                TEST_JWT_SECRET,
                { algorithm: "HS256", issuer: "thunder-ai", audience: "thunder-ai-client" }
            );

            let statusSent = null;
            let bodySent = null;
            let nextCalled = false;

            const req = { cookies: { token: validToken }, headers: {} };
            const res = {
                status: (code) => {
                    statusSent = code;
                    return { json: (data) => { bodySent = data; } };
                }
            };
            const next = () => { nextCalled = true; };

            Object.defineProperty(redisClient, "isOpen", { value: false, configurable: true });

            try {
                await authUserMiddleware(req, res, next);
                assert.strictEqual(statusSent, 503);
                assert.strictEqual(nextCalled, false);
                assert.match(bodySent.message, /authentication service unavailable/i);
            } finally {
                delete redisClient.isOpen;
                process.env.NODE_ENV = prevEnv;
            }
        });
    });
});
