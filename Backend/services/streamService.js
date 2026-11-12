import { redisClient } from "../config/redis.js";

/**
 * OPTION A: Memory-Capped Redis Streams Service
 * Keeps memory strictly under ~300 KB by maintaining an approximate maximum
 * length (MAXLEN ~ 1000). Old events automatically evict in O(1) time.
 */

const STREAM_TELEMETRY_KEY = "stream:telemetry";
const STREAM_SECURITY_KEY = "stream:security";
const DEFAULT_MAX_LEN = 1000;

/**
 * Publishes an event to a Redis Stream with strict memory capping.
 */
export const logStreamEvent = async (streamKey, eventName, data = {}, maxLen = DEFAULT_MAX_LEN) => {
  try {
    if (!redisClient.isOpen) return null;

    // Convert all fields to strings for Redis Stream serialization
    const payload = {
      event: String(eventName),
      timestamp: String(Date.now()),
    };

    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && v !== null) {
        payload[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      }
    }

    // XADD with MAXLEN ~ maxLen to enforce 30MB Redis Cloud memory safety
    const entryId = await redisClient.xAdd(streamKey, "*", payload, {
      TRIM: {
        strategy: "MAXLEN",
        strategyModifier: "~",
        threshold: maxLen,
      },
    });

    return entryId;
  } catch (err) {
    // Non-blocking telemetry fail-safe
    console.warn(`[RedisStream] Failed to publish to ${streamKey}:`, err.message);
    return null;
  }
};

/**
 * Helper for logging general operational telemetry (chat messages, tokens, model routing).
 */
export const logTelemetry = async (eventName, data = {}) => {
  return logStreamEvent(STREAM_TELEMETRY_KEY, eventName, data, 1000);
};

/**
 * Helper for logging critical security events (logins, password resets, rate limits).
 */
export const logSecurityEvent = async (eventName, data = {}) => {
  return logStreamEvent(STREAM_SECURITY_KEY, eventName, data, 500);
};

/**
 * Reads recent events from a stream (useful for live admin monitoring).
 */
export const getRecentStreamEvents = async (streamKey = STREAM_TELEMETRY_KEY, count = 20) => {
  try {
    if (!redisClient.isOpen) return [];
    const entries = await redisClient.xRevRange(streamKey, "+", "-", { COUNT: count });
    return entries.map((entry) => ({
      id: entry.id,
      ...entry.message,
    }));
  } catch (err) {
    console.warn(`[RedisStream] Failed to read from ${streamKey}:`, err.message);
    return [];
  }
};
