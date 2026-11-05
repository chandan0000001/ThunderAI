import { redisClient } from "../config/redis.js";

const adminRateLimiter = async (req, res, next) => {
    try {
        const userId = req.userId || req.user?._id;
        const key = `rate-limit:admin:${userId}`;

        const requestCount = await redisClient.incr(key);
        if (requestCount === 1) {
            await redisClient.expire(key, 60);
        }

        const maxAllowed = 120; // 120 requests/min for admin operations
        if (requestCount > maxAllowed) {
            const remainingTime = await redisClient.ttl(key);
            return res.status(429).json({
                message: `Admin operation rate limit reached. Retry after ${remainingTime} seconds.`
            });
        }
        next();
    } catch (error) {
        console.warn("Admin rate limiter Redis warning:", error.message);
        next();
    }
};

export default adminRateLimiter;
