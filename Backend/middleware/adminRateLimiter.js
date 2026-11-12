import { redisClient } from "../config/redis.js";
import { fallbackLimiter } from "../utils/fallbackRateLimiter.js";

const adminRateLimiter = async (req, res, next) => {
    const maxAllowed = 120; // 120 requests/min for admin operations
    const userId = req.userId || req.user?._id || req.ip;

    try {
        const key = `rate-limit:admin:${userId}`;

        const requestCount = await redisClient.incr(key);
        if (requestCount === 1) {
            await redisClient.expire(key, 60);
        }

        if (requestCount > maxAllowed) {
            const remainingTime = await redisClient.ttl(key);
            return res.status(429).json({
                message: `Admin operation rate limit reached. Retry after ${remainingTime} seconds.`
            });
        }
        next();
    } catch (error) {
        // F-05 Remediation: Enforce in-memory fallback limit during Redis outages
        console.warn(`[RateLimiter] Redis unavailable; applying in-memory fallback rate limit for admin: ${userId}`);
        const fallback = fallbackLimiter.checkLimit(`admin:${userId}`, maxAllowed, 60);
        if (!fallback.allowed) {
            return res.status(429).json({
                message: `Admin operation rate limit reached. Retry after ${fallback.remainingTime} seconds.`
            });
        }
        next();
    }
};

export default adminRateLimiter;
