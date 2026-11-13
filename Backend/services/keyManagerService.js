import crypto from "crypto";
import { redisClient } from "../config/redis.js";

// In-memory fallback counters if Redis counter experiences glitch
const inMemoryCounters = new Map();

/**
 * Resolves a dedicated 32-byte AES-256 key strictly from BYOK_ENCRYPTION_KEY.
 * F-08 Remediation: Enforces exactly 64 hexadecimal characters (32 bytes).
 * Rejects missing, malformed, placeholder, or weak configuration.
 * Strictly avoids hashing arbitrary passphrases into encryption keys.
 */
export const getEncryptionKey = () => {
  const raw = process.env.BYOK_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("BYOK_ENCRYPTION_KEY is required and missing from environment configuration");
  }

  // Reject documentation placeholders
  const lower = raw.toLowerCase();
  if (lower.includes("your_") || lower.includes("placeholder") || lower.includes("encryption_key")) {
    throw new Error("BYOK_ENCRYPTION_KEY contains a placeholder value; a real 64-hex key is required");
  }

  // Reject non-conforming lengths (must be exactly 64 hex characters for 32 bytes)
  if (raw.length !== 64) {
    throw new Error(`BYOK_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (got ${raw.length})`);
  }

  // Reject non-hexadecimal characters
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("BYOK_ENCRYPTION_KEY must consist exclusively of hexadecimal characters [0-9a-fA-F]");
  }

  // Reject weak trivial repeating keys (e.g. 0000... or 1111...)
  if (raw === raw[0].repeat(64)) {
    throw new Error("BYOK_ENCRYPTION_KEY is insecure (trivial repeated character pattern)");
  }

  return Buffer.from(raw, "hex");
};

/**
 * Validates key manager cryptographic configuration at startup.
 * F-08: Production startup strictly fails if BYOK_ENCRYPTION_KEY is absent or malformed.
 */
export const validateKeyManagerConfig = () => {
  try {
    const key = getEncryptionKey();
    if (!key || key.length !== 32) {
      throw new Error("BYOK encryption key length is not 32 bytes");
    }
    return true;
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[CRITICAL STARTUP FAILURE] ${err.message}`);
    }
    console.warn(`[KeyManager] CONFIG WARNING: ${err.message}. Provide a 64-char hex key.`);
    return false;
  }
};

/**
 * AES-256-GCM authenticated encryption for Redis BYOK storage.
 */
export const encryptAES = (text) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = cipher.update(text, "utf8", "base64");
  enc += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${enc}`;
};

/**
 * F-03 Remediation: Strict AES-256-GCM authenticated decryption.
 * Fails closed on authentication-tag mismatch or malformed inputs.
 * Never treats ciphertext or corrupted records as valid credential material.
 */
export const decryptAES = (payload) => {
  if (!payload || typeof payload !== "string") {
    return "";
  }

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid BYOK ciphertext format: expected 3 base64 segments");
  }

  const [ivB64, tagB64, encB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error("Invalid BYOK ciphertext dimensions: IV must be 12 bytes and authTag 16 bytes");
  }

  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let dec = decipher.update(encB64, "base64", "utf8");
    dec += decipher.final("utf8");
    return dec;
  } catch (err) {
    throw new Error(`BYOK decryption failed: ${err.message}`);
  }
};

/**
 * VULN-17 Remediation: Atomic distributed round-robin counter via Redis INCR
 */
const getNextCounter = async (key, max) => {
  if (max <= 1) return 0;
  try {
    const val = await redisClient.incr(key);
    return Math.abs(val - 1) % max;
  } catch {
    const cur = inMemoryCounters.get(key) || 0;
    inMemoryCounters.set(key, (cur + 1) % max);
    return cur;
  }
};

// Helper to determine AI provider from model ID
export const getProviderFromModel = (model = "") => {
  const m = model.toLowerCase();
  if (m.startsWith("groq/") || m.includes("groq") || m.includes("llama-3.3-70b-versatile")) {
    return "groq";
  }
  if (m.startsWith("anthropic/") || m.includes("claude")) {
    return "claude";
  }
  if (m.startsWith("openai/") || m.includes("gpt-") || m.startsWith("o1") || m.startsWith("o3")) {
    return "chatgpt";
  }
  return "openrouter";
};

// Parse comma-separated keys from environment variable
export const getSystemKeys = (provider) => {
  let raw = "";
  if (provider === "openrouter") raw = process.env.OPENROUTER_API_KEY || "";
  else if (provider === "groq") raw = process.env.GROQ_API_KEY || "";
  else if (provider === "claude") raw = process.env.ANTHROPIC_API_KEY || "";
  else if (provider === "chatgpt") raw = process.env.OPENAI_API_KEY || "";

  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
};

// Save custom API key(s) in Redis encrypted with strict 3-hour (10,800s) inactivity lease
export const saveUserApiKey = async (userId, provider, apiKeyString) => {
  if (!userId || !provider || !apiKeyString) {
    throw new Error("userId, provider, and apiKey are required");
  }

  const validProviders = ["openrouter", "groq", "claude", "chatgpt"];
  if (!validProviders.includes(provider)) {
    throw new Error(`Invalid provider. Supported: ${validProviders.join(", ")}`);
  }

  // Validate format (each key must be non-empty)
  const keys = apiKeyString
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    throw new Error("At least one valid API key must be provided");
  }

  const redisKey = `byok:${userId}:${provider}`;
  // VULN-10: Store encrypted keys with 3 hours (10,800s) lease
  const encryptedPayload = encryptAES(keys.join(","));
  await redisClient.set(redisKey, encryptedPayload, { EX: 10800 });

  return {
    provider,
    keyCount: keys.length,
    ttl: 10800,
    masked: maskKey(keys[0]),
  };
};

// Get user API keys from Redis (decrypted), renewing 3-hour lease on active usage
export const getUserApiKeys = async (userId, provider, renewLease = true) => {
  if (!userId || !provider) return [];
  const redisKey = `byok:${userId}:${provider}`;

  try {
    const raw = await redisClient.get(redisKey);
    if (!raw) return [];

    if (renewLease) {
      // Renew 3-hour (10,800s) inactivity lease when user makes active requests
      await redisClient.expire(redisKey, 10800);
    }

    const decrypted = decryptAES(raw);
    return decrypted
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  } catch (err) {
    console.warn(`Redis BYOK read error for ${userId}:${provider}:`, err.message);
    return [];
  }
};

// Delete user API key from Redis
export const deleteUserApiKey = async (userId, provider) => {
  const redisKey = `byok:${userId}:${provider}`;
  await redisClient.del(redisKey);
  await redisClient.del(`rr:user:${userId}:${provider}`);
  return { provider, deleted: true };
};

// Get list of all providers with active BYOK keys for a user
export const getUserConfiguredProviders = async (userId) => {
  const providers = ["groq", "openrouter", "claude", "chatgpt"];
  const results = [];

  for (const prov of providers) {
    const redisKey = `byok:${userId}:${prov}`;
    try {
      const raw = await redisClient.get(redisKey);
      if (raw) {
        const ttl = await redisClient.ttl(redisKey);
        const decrypted = decryptAES(raw);
        const keys = decrypted.split(",").map((k) => k.trim()).filter(Boolean);
        results.push({
          provider: prov,
          active: true,
          keyCount: keys.length,
          maskedKey: maskKey(keys[0]),
          ttlRemainingSeconds: ttl > 0 ? ttl : 0,
        });
      } else {
        results.push({
          provider: prov,
          active: false,
          keyCount: 0,
        });
      }
    } catch (e) {
      results.push({ provider: prov, active: false, keyCount: 0 });
    }
  }

  return results;
};

// Alias for backwards compatibility
export const getUserKeyStatuses = getUserConfiguredProviders;

// Return candidate keys in current round-robin priority order for failover resilience
export const getCandidateKeys = async (userId, provider, { useThunderEngine = true } = {}) => {
  // 1. If User Custom Key (BYOK) mode is selected (useThunderEngine === false)
  if (!useThunderEngine) {
    const userKeys = await getUserApiKeys(userId, provider, true);
    if (!userKeys || userKeys.length === 0) {
      throw new Error(`No API key configured for ${provider.toUpperCase()}. Please configure your key in Settings or switch ON Thunder Internal Engine.`);
    }

    const currentIndex = await getNextCounter(`rr:user:${userId}:${provider}`, userKeys.length);
    const candidates = [];
    for (let i = 0; i < userKeys.length; i++) {
      candidates.push({
        apiKey: userKeys[(currentIndex + i) % userKeys.length],
        isUserKey: true,
        provider,
      });
    }
    return candidates;
  }

  // 2. Thunder Internal Engine mode (useThunderEngine === true)
  // Candidate pool with primary provider keys first
  const candidates = [];
  const primaryKeys = getSystemKeys(provider);
  if (primaryKeys.length > 0) {
    const currentIndex = await getNextCounter(`rr:sys:${provider}`, primaryKeys.length);
    for (let i = 0; i < primaryKeys.length; i++) {
      candidates.push({
        apiKey: primaryKeys[(currentIndex + i) % primaryKeys.length],
        isUserKey: false,
        provider,
      });
    }
  }

  // 3. Fallback across all other active providers in environment
  const fallbackOrder = ["groq", "openrouter", "claude", "chatgpt"];
  for (const altProvider of fallbackOrder) {
    if (altProvider === provider) continue;
    const altKeys = getSystemKeys(altProvider);
    if (altKeys.length > 0) {
      const altIndex = await getNextCounter(`rr:sys:${altProvider}`, altKeys.length);
      for (let i = 0; i < altKeys.length; i++) {
        candidates.push({
          apiKey: altKeys[(altIndex + i) % altKeys.length],
          isUserKey: false,
          provider: altProvider,
        });
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error(`No API keys configured in environment for ${provider.toUpperCase()}.`);
  }

  return candidates;
};

// Round-Robin Key Selector
export const getActiveApiKey = async (userId, provider, { useThunderEngine = true } = {}) => {
  const candidates = await getCandidateKeys(userId, provider, { useThunderEngine });
  return {
    ...candidates[0],
    totalKeysInPool: candidates.length,
    rotationIndex: 0,
  };
};

// Mask key for secure display
function maskKey(key = "") {
  if (!key || key.length < 8) return "••••••••";
  const start = key.slice(0, 7);
  const end = key.slice(-4);
  return `${start}...${end}`;
}
