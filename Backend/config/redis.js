import { createClient } from "redis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const isProduction = process.env.NODE_ENV === "production";
const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;

// F-10 Remediation: Remove localhost fallback in production; fail startup safely if Redis config is absent
if (isProduction && !redisUrl) {
  throw new Error("Critical production startup failure: REDIS_URL is mandatory in production environment. Localhost fallback is prohibited.");
}

const resolvedRedisUrl = redisUrl || "redis://localhost:6379";

const redisClient = createClient({
  url: resolvedRedisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error("Redis max reconnection retries reached");
        return new Error("Redis max retries reached");
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on("error", (error) => {
  console.log("Redis error:", error.message || error);
});

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log("Redis connected successfully to", resolvedRedisUrl.split("@").pop());
    }
  } catch (err) {
    console.error("Redis initial connection failed:", err.message);
    if (isProduction) {
      throw new Error(`Critical startup failure: Unable to connect to mandatory production Redis: ${err.message}`);
    }
  }
};

export { redisClient, connectRedis };