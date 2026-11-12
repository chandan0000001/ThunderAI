import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || "redis://localhost:6379";

if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL && !process.env.REDIS_URI) {
  console.warn("⚠️ [SECURITY WARNING] REDIS_URL is not set in production. Falling back to local Redis instance.");
}

const redisClient = createClient({
  url: redisUrl,
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
      console.log("Redis connected successfully to", redisUrl.split("@").pop());
    }
  } catch (err) {
    console.error("Redis initial connection failed:", err.message);
  }
};

export { redisClient, connectRedis };