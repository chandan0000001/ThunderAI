import { redisClient } from "../config/redis.js";
import { isAdminEmail } from "../utils/adminUtils.js";
import { fallbackLimiter } from "../utils/fallbackRateLimiter.js";

const authenticatedRateLimiter = async (req, res, next) => {
    const maxAllowed = req.method === "GET" ? 100 : 40;
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

        if (requestCount > maxAllowed) {
            const remainingTime = await redisClient.ttl(key);

            return res.status(429).json({
                message: `Too many requests. Try again after ${remainingTime} seconds.`
            });
        }

        next();
    } catch (error) {
        // F-05 Remediation: Enforce local in-memory fallback rate limiting during Redis outages
        console.warn(`[RateLimiter] Redis unavailable; applying in-memory fallback rate limit for user: ${req.userId}`);
        const fallback = fallbackLimiter.checkLimit(`user:${req.userId}`, maxAllowed, 60);
        if (!fallback.allowed) {
            return res.status(429).json({
                message: `Too many requests. Try again after ${fallback.remainingTime} seconds.`
            });
        }
        next();
    }
};

export default authenticatedRateLimiter;
