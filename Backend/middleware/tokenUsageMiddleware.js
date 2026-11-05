import { redisClient } from "../config/redis.js";
import { isAdminEmail } from "../utils/adminUtils.js";
import { getProviderFromModel, getUserApiKeys } from "../services/keyManagerService.js";

const tokenUsageMiddleware = async (req, res, next) => {
    try {
        const key = `token-usage:${req.userId}`;
        req.tokenUsageKey = key;

        // Admin has UNLIMITED token quota and zero rate restriction
        const isAdmin =
            req.user?.role === "admin" ||
            isAdminEmail(req.user?.email) ||
            isAdminEmail(req.tokenPayload?.email);

        if (isAdmin) {
            return next();
        }

        // BYOK: If user toggled Custom Key mode or configured their own key, rate limits are managed by provider
        const useThunderEngine = req.body?.useThunderEngine ?? true;
        if (!useThunderEngine) {
            return next();
        }

        const model = req.body?.model;
        if (model) {
            const provider = getProviderFromModel(model);
            const userKeys = await getUserApiKeys(req.userId, provider, false);
            if (userKeys.length > 0) {
                return next();
            }
        }

        const tokenUsed = await redisClient.get(key);
        const tokenLimit = Number(process.env.TOKEN_LIMIT || 10000);

        if (Number(tokenUsed || 0) >= tokenLimit) {
            const remainingTime = await redisClient.ttl(key);

            return res.status(429).json({
                message: "Token limit reached. Please try after some time, or add your own API key in Settings to continue without limits.",
                tokenUsed: Number(tokenUsed),
                tokenLimit,
                retryAfter: remainingTime
            });
        }

        next();
    } catch (error) {
        console.log("Token usage middleware error:", error);
        next();
    }
};

export default tokenUsageMiddleware;
