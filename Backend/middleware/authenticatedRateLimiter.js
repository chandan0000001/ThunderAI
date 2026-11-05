import { redisClient } from "../config/redis.js";
import { isAdminEmail } from "../utils/adminUtils.js";

const authenticatedRateLimiter = async (req, res, next) => {
    try {
        const isAdmin =
            req.user?.role === "admin" ||
            isAdminEmail(req.user?.email) ||
            isAdminEmail(req.tokenPayload?.email);

        // Admin has UNLIMITED window requests
        if (isAdmin) {
            return next();
        }

        const userId = req.userId;

        const key = `rate-limit:user:${userId}`;

        const requestCount = await redisClient.incr(key);

        if (requestCount === 1) {
            await redisClient.expire(key, 60);
        }

        const maxAllowed = req.method === "GET" ? 100 : 40;

        if (requestCount > maxAllowed) {
            const remainingTime = await redisClient.ttl(key);

            return res.status(429).json({
                message: `Too many requests. Try again after ${remainingTime} seconds.`
            });
        }

        next();
    } catch (error) {
        console.log("Authenticated rate limiter error:", error);
        next();
    }
};

export default authenticatedRateLimiter;
