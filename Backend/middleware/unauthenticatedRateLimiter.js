import { redisClient } from "../config/redis.js";
import { fallbackLimiter } from "../utils/fallbackRateLimiter.js";

const unauthenticatedRateLimiter = async (req, res, next) => {
    try {
        const key = `rate-limit:ip:${req.ip}`;

        const requestCount = await redisClient.incr(key);

        if (requestCount === 1) {
            await redisClient.expire(key, 60);
        }

        if (requestCount > 10) {
            const remainingTime = await redisClient.ttl(key);

            return res.status(429).json({
                message: `Too many requests. Try again after ${remainingTime} seconds.`
            });
        }

        next();
    } catch (error) {
        // F-05 Remediation: Fail gracefully to bounded in-memory rate limiter instead of failing open
        console.warn(`[RateLimiter] Redis unavailable; applying in-memory fallback rate limit for IP: ${req.ip}`);
        const fallback = fallbackLimiter.checkLimit(`ip:${req.ip}`, 10, 60);
        if (!fallback.allowed) {
            return res.status(429).json({
                message: `Too many requests. Try again after ${fallback.remainingTime} seconds.`
            });
        }
        next();
    }
};

export default unauthenticatedRateLimiter;