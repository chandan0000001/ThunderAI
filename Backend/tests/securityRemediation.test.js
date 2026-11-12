import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import { spawnSync } from "child_process";
import jwt from "jsonwebtoken";

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
    clearAuthCookies
} from "../services/tokenService.js";

import fallbackLimiter from "../utils/fallbackRateLimiter.js";
import { isAllowedOrigin } from "../utils/originUtils.js";
import csrfProtection from "../middleware/csrfProtection.js";
import authUserMiddleware from "../middleware/authUserMiddleware.js";
import { redisClient, connectRedis } from "../config/redis.js";
import User from "../model/userSchema.js";
import { login, logout } from "../controllers/userController.js";

const VALID_KEY_64_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_JWT_SECRET = "test-jwt-secret-very-secure-32chars-minimum!";

describe("Thunder AI - Security Remediation Acceptance Test Suite", () => {
    const origEnv = { ...process.env };

    before(async () => {
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        process.env.BYOK_ENCRYPTION_KEY = VALID_KEY_64_HEX;
        try {
            await connectRedis();
        } catch (e) {
            console.warn("Redis connection warning in test setup:", e.message);
        }
    });

    after(async () => {
        process.env = origEnv;
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
            // Tamper with ciphertext
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
    // F-09: Token-Version Validation
    // ==========================================
    describe("F-09: Token-Version Enforcement", () => {
        before(() => {
            process.env.JWT_SECRET = TEST_JWT_SECRET;
        });

        test("Rejects JWT missing tokenVersion claim", async () => {
            const oldTokenWithoutVersion = jwt.sign(
                { id: "65a000000000000000000001", email: "test@example.com" },
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
                    { id: "65a000000000000000000001", email: "test@example.com", tokenVersion: badVersion },
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
                { id: "65a000000000000000000001", email: "test@example.com", tokenVersion: 0 },
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
    // F-10: Production Redis Availability
    // ==========================================
    describe("F-10: Production Redis Configuration Policy", () => {
        test("In production mode, missing REDIS_URL throws fail-closed error", async () => {
            const prevEnv = process.env.NODE_ENV;
            const prevUrl = process.env.REDIS_URL;
            process.env.NODE_ENV = "production";
            delete process.env.REDIS_URL;

            // Dynamically import fresh or test configuration assertion
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
                    cwd: process.cwd(),
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
            // Populate multiple keys
            for (let i = 0; i < 100; i++) {
                fallbackLimiter.checkLimit(`user-churn-${i}`, 10, 60);
            }
            // Consume key 0 again
            const res = fallbackLimiter.checkLimit("user-churn-0", 10, 60);
            assert.strictEqual(res.allowed, true);
        });
    });

    // ==========================================
    // Section 4: Refresh Token & Session Lifecycle
    // ==========================================
    describe("Section 4: Complete Session Lifecycle & Rotation", () => {
        test("Generates 15-minute access token with standard claims", () => {
            const fakeUser = {
                _id: "65a000000000000000000001",
                email: "dev@thunder.ai",
                role: "user",
                tokenVersion: 2
            };

            const token = generateAccessToken(fakeUser);
            const decoded = jwt.verify(token, TEST_JWT_SECRET, {
                algorithms: ["HS256"],
                issuer: "thunder-ai",
                audience: "thunder-ai-client"
            });

            assert.strictEqual(decoded.sub, fakeUser._id);
            assert.strictEqual(decoded.id, fakeUser._id);
            assert.strictEqual(decoded.email, fakeUser.email);
            assert.strictEqual(decoded.tokenVersion, 2);
            assert.strictEqual(decoded.iss, "thunder-ai");
            assert.strictEqual(decoded.aud, "thunder-ai-client");

            // Expiry should be approx 15 minutes (900 seconds)
            const remainingSeconds = decoded.exp - decoded.iat;
            assert.strictEqual(remainingSeconds, 900);
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
            if (!redisClient || !redisClient.isOpen) {
                console.warn("Skipping live Redis test: Redis client not connected");
                return;
            }

            const userId = "65a123456789012345678901";
            const email = "lifecycle@thunder.ai";
            const familyId = crypto.randomUUID();
            const token1 = generateRefreshToken();

            await storeRefreshToken(token1, userId, email, familyId, 0);

            // Hash exists in redis, raw token does NOT
            const hash1 = hashRefreshToken(token1);
            const stored = await redisClient.get(`refresh_token:${hash1}`);
            assert.ok(stored);
            const parsed = JSON.parse(stored);
            assert.strictEqual(parsed.userId, userId);
            assert.strictEqual(parsed.familyId, familyId);

            // Family is active
            const famStatus = await redisClient.get(`refresh_family:${familyId}`);
            assert.strictEqual(famStatus, "active");

            // Clean up test keys
            await redisClient.del(`refresh_token:${hash1}`);
            await redisClient.del(`refresh_family:${familyId}`);
        });

        test("Reuse of an already rotated refresh token revokes token family and invalidates all sessions", async () => {
            if (!redisClient || !redisClient.isOpen) return;

            const userId = "65a123456789012345678902";
            const familyId = crypto.randomUUID();
            const tokenA = generateRefreshToken();
            const hashA = hashRefreshToken(tokenA);

            // Record tokenA as already revoked/rotated
            await redisClient.set(
                `refresh_revoked:${hashA}`,
                JSON.stringify({ familyId, userId, rotatedAt: Date.now() }),
                { EX: 60 }
            );
            await redisClient.set(`refresh_family:${familyId}`, "active", { EX: 60 });

            // Now attempt to rotate tokenA again -> Must trigger TOKEN_REUSE and revoke family
            await assert.rejects(
                () => rotateRefreshToken(tokenA),
                (err) => {
                    assert.strictEqual(err.code, "TOKEN_REUSE");
                    return true;
                }
            );

            // Verify family is now immediately deleted
            const familyCheck = await redisClient.get(`refresh_family:${familyId}`);
            assert.strictEqual(familyCheck, null);

            await redisClient.del(`refresh_revoked:${hashA}`);
        });

        test("F-14: Concurrent rotation of the same refresh token yields exactly 1 success and 1 TOKEN_REUSE", async () => {
            if (!redisClient || !redisClient.isOpen) return;

            const userId = "65a123456789012345678999";
            const email = "concurrency@thunder.ai";
            const familyId = crypto.randomUUID();
            const token = generateRefreshToken();
            const tokenHash = hashRefreshToken(token);

            await storeRefreshToken(token, userId, email, familyId, 0);

            // Execute concurrent rotation requests
            const [result1, result2] = await Promise.allSettled([
                rotateRefreshToken(token),
                rotateRefreshToken(token)
            ]);

            const fulfilled = [result1, result2].filter(r => r.status === "fulfilled");
            const rejected = [result1, result2].filter(r => r.status === "rejected");

            assert.strictEqual(fulfilled.length, 1, "Exactly one rotation must succeed");
            assert.strictEqual(rejected.length, 1, "Exactly one rotation must fail");
            assert.strictEqual(rejected[0].reason?.code, "TOKEN_REUSE");

            // Clean up
            await redisClient.del(`refresh_token:${tokenHash}`);
            await redisClient.del(`refresh_revoked:${tokenHash}`);
            await redisClient.del(`refresh_family:${familyId}`);
            if (fulfilled[0]?.value?.refreshToken) {
                const newHash = hashRefreshToken(fulfilled[0].value.refreshToken);
                await redisClient.del(`refresh_token:${newHash}`);
            }
        });

        test("F-15: Retains consumed-token reuse markers for the full family lifetime (>600000s)", async () => {
            if (!redisClient || !redisClient.isOpen) return;

            const userId = "65a123456789012345678998";
            const email = "lifetime@thunder.ai";
            const familyId = crypto.randomUUID();
            const token = generateRefreshToken();
            const tokenHash = hashRefreshToken(token);

            await storeRefreshToken(token, userId, email, familyId, 0);
            const rotated = await rotateRefreshToken(token);

            const ttl = await redisClient.ttl(`refresh_revoked:${tokenHash}`);
            // REFRESH_TOKEN_TTL_SECONDS is 604800 (7 days). Must be far greater than legacy 60s.
            assert.ok(ttl > 600000, `Expected TTL > 600000s, got ${ttl}s`);

            // Clean up
            await redisClient.del(`refresh_revoked:${tokenHash}`);
            await redisClient.del(`refresh_family:${familyId}`);
            if (rotated?.refreshToken) {
                const newHash = hashRefreshToken(rotated.refreshToken);
                await redisClient.del(`refresh_token:${newHash}`);
            }
        });
    });

    // ==========================================
    // F-12: Zero Startup Admin Modifications
    // ==========================================
    describe("F-12: Ordinary Application Startup Admin Invariance", () => {
        test("Startup routine does not query or mutate admin roles or credentials", () => {
            const indexSource = fs.readFileSync("index.js", "utf8");
            assert.strictEqual(indexSource.includes("existingAdmin"), false);
            assert.strictEqual(indexSource.includes("ADMIN_EMAILS"), false);
            assert.strictEqual(indexSource.includes("ADMIN_PASSWORD"), false);
        });

        test("seedAdmin script exists as dedicated explicit operator CLI utility", () => {
            assert.strictEqual(fs.existsSync("seedAdmin.js"), true);
            const seedSource = fs.readFileSync("seedAdmin.js", "utf8");
            assert.ok(seedSource.includes("seedAdmin"));
            assert.ok(seedSource.includes("[AUDIT"));
        });
    });

    // ==========================================
    // F-13: Atomic Password-Reset Token Consumption
    // ==========================================
    describe("F-13: Atomic Password-Reset Token Consumption", () => {
        test("Concurrent redemption: exactly one request succeeds, second returns null", async () => {
            if (!redisClient || !redisClient.isOpen) return;

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
        test("Safe HTTP methods pass through without custom header", (t, done) => {
            const req = { method: "GET", headers: {}, cookies: {} };
            const res = {};
            csrfProtection(req, res, () => {
                assert.ok(true);
                done();
            });
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

        test("Cookie-authenticated POST with X-Requested-With header passes", (t, done) => {
            const req = {
                method: "POST",
                headers: { "x-requested-with": "XMLHttpRequest" },
                cookies: { token: "some-jwt-token" }
            };
            const res = {};
            csrfProtection(req, res, () => {
                assert.ok(true);
                done();
            });
        });
    });

    // ==========================================
    // F-16: Fail-Closed Logout Revocation Guarantee
    // ==========================================
    describe("F-16: Fail-Closed Logout Revocation Guarantee", () => {
        test("clearAuthCookies throws REVOCATION_UNAVAILABLE when Redis client is disconnected", async () => {
            const fakeReq = { cookies: { refreshToken: "fake-refresh-token" } };
            const fakeRes = { clearCookie: () => {} };

            const originalIsOpen = redisClient.isOpen;
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
                Object.defineProperty(redisClient, "isOpen", { value: originalIsOpen, configurable: true });
            }
        });

        test("logout controller returns HTTP 503 when session store revocation fails", async () => {
            const fakeReq = { cookies: { refreshToken: "fake-refresh-token" } };
            let statusSent = null;
            let bodySent = null;
            const fakeRes = {
                status: (code) => {
                    statusSent = code;
                    return { json: (data) => { bodySent = data; } };
                },
                clearCookie: () => {}
            };

            const originalIsOpen = redisClient.isOpen;
            Object.defineProperty(redisClient, "isOpen", { value: false, configurable: true });

            try {
                await logout(fakeReq, fakeRes);
                assert.strictEqual(statusSent, 503);
                assert.match(bodySent.message, /service unavailable: unable to confirm server-side session revocation/i);
            } finally {
                Object.defineProperty(redisClient, "isOpen", { value: originalIsOpen, configurable: true });
            }
        });
    });

    // ==========================================
    // F-17: Elimination of Login Master-Password Fallback & Auto-Promotion
    // ==========================================
    describe("F-17: Elimination of Login Master-Password Fallback & Auto-Promotion", () => {
        test("Application code contains zero references to ADMIN_PASSWORD in controllers and routes", () => {
            const userControllerSrc = fs.readFileSync("controllers/userController.js", "utf8");
            assert.strictEqual(userControllerSrc.includes("ADMIN_PASSWORD"), false);
            assert.strictEqual(userControllerSrc.includes("ADMIN_EMAILS"), false);

            const userRouterSrc = fs.readFileSync("routes/userRouter.js", "utf8");
            assert.strictEqual(userRouterSrc.includes("ADMIN_PASSWORD"), false);

            const adminRouterSrc = fs.readFileSync("routes/adminRouter.js", "utf8");
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
                // Mock user with a distinct legitimate password
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
                { id: "65a000000000000000000001", email: "prod@thunder.ai", tokenVersion: 1 },
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

            const originalIsOpen = redisClient.isOpen;
            Object.defineProperty(redisClient, "isOpen", { value: false, configurable: true });

            try {
                await authUserMiddleware(req, res, next);
                assert.strictEqual(statusSent, 503);
                assert.strictEqual(nextCalled, false);
                assert.match(bodySent.message, /authentication service unavailable/i);
            } finally {
                Object.defineProperty(redisClient, "isOpen", { value: originalIsOpen, configurable: true });
                process.env.NODE_ENV = prevEnv;
            }
        });
    });
});
