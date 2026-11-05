import { redisClient } from "../config/redis.js";

// In-memory round-robin circular counters
const systemKeyIndices = {
  openrouter: 0,
  groq: 0,
  claude: 0,
  chatgpt: 0,
};

const userKeyIndices = new Map();

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

// Save custom API key(s) in Redis with strict 3-hour (10,800s) inactivity lease
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
  // Store comma-separated keys with 3 hours (10800 seconds) expiration
  await redisClient.set(redisKey, keys.join(","), { EX: 10800 });

  return {
    provider,
    keyCount: keys.length,
    ttl: 10800,
    masked: maskKey(keys[0]),
  };
};

// Get user API keys from Redis, renewing 3-hour lease on active usage
export const getUserApiKeys = async (userId, provider, renewLease = true) => {
  if (!userId || !provider) return [];
  const redisKey = `byok:${userId}:${provider}`;

  try {
    const val = await redisClient.get(redisKey);
    if (!val) return [];

    if (renewLease) {
      // Renew 3-hour (10,800s) inactivity lease when user makes active requests
      await redisClient.expire(redisKey, 10800);
    }

    return val
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
  userKeyIndices.delete(`${userId}:${provider}`);
  return { provider, deleted: true };
};

// Get list of all providers with active BYOK keys for a user
export const getUserConfiguredProviders = async (userId) => {
  const providers = ["openrouter", "groq", "claude", "chatgpt"];
  const results = [];

  for (const prov of providers) {
    const redisKey = `byok:${userId}:${prov}`;
    try {
      const val = await redisClient.get(redisKey);
      if (val) {
        const ttl = await redisClient.ttl(redisKey);
        const keys = val.split(",").map((k) => k.trim()).filter(Boolean);
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

// Return candidate keys in current round-robin priority order for failover resilience
export const getCandidateKeys = async (userId, provider, { useThunderEngine = true } = {}) => {
  // 1. If User Custom Key (BYOK) mode is selected (useThunderEngine === false)
  if (!useThunderEngine) {
    const userKeys = await getUserApiKeys(userId, provider, true);
    if (!userKeys || userKeys.length === 0) {
      throw new Error(`No API key configured for ${provider.toUpperCase()}. Please configure your key in Settings or switch ON Thunder Internal Engine.`);
    }

    const mapKey = `${userId}:${provider}`;
    const currentIndex = userKeyIndices.get(mapKey) || 0;
    const candidates = [];
    for (let i = 0; i < userKeys.length; i++) {
      candidates.push({
        apiKey: userKeys[(currentIndex + i) % userKeys.length],
        isUserKey: true,
        provider,
      });
    }
    userKeyIndices.set(mapKey, (currentIndex + 1) % userKeys.length);
    return candidates;
  }

  // 2. Thunder Internal Engine mode (useThunderEngine === true)
  // Candidate pool with primary provider keys first
  const candidates = [];
  const primaryKeys = getSystemKeys(provider);
  if (primaryKeys.length > 0) {
    const currentIndex = systemKeyIndices[provider] || 0;
    for (let i = 0; i < primaryKeys.length; i++) {
      candidates.push({
        apiKey: primaryKeys[(currentIndex + i) % primaryKeys.length],
        isUserKey: false,
        provider,
      });
    }
    systemKeyIndices[provider] = (currentIndex + 1) % primaryKeys.length;
  }

  // 3. Fallback across all other active providers in environment
  const fallbackOrder = ["groq", "openrouter", "claude", "chatgpt"];
  for (const altProvider of fallbackOrder) {
    if (altProvider === provider) continue;
    const altKeys = getSystemKeys(altProvider);
    if (altKeys.length > 0) {
      const altIndex = systemKeyIndices[altProvider] || 0;
      for (let i = 0; i < altKeys.length; i++) {
        candidates.push({
          apiKey: altKeys[(altIndex + i) % altKeys.length],
          isUserKey: false,
          provider: altProvider,
        });
      }
      systemKeyIndices[altProvider] = (altIndex + 1) % altKeys.length;
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
