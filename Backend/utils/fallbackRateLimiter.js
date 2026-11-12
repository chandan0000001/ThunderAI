/**
 * F-05 Remediation: In-Memory Bounded Fallback Rate Limiter
 *
 * Ensures authentication, OTP, password reset, and message endpoints
 * remain protected against brute force and abuse even during Redis outages.
 *
 * Designed with a strict 10,000-entry capacity limit and automatic pruning
 * to prevent memory exhaustion in constrained environments.
 */

class BoundedFallbackRateLimiter {
    constructor(maxCapacity = 10000) {
        this.store = new Map();
        this.maxCapacity = maxCapacity;
    }

    /**
     * Checks if a key exceeds rate limit within a rolling window.
     *
     * @param {string} key - Identifier (e.g., IP address or userId)
     * @param {number} maxAllowed - Maximum requests permitted in window
     * @param {number} windowSeconds - Duration of window in seconds
     * @returns {{ allowed: boolean, count: number, remainingTime: number }}
     */
    checkLimit(key, maxAllowed = 10, windowSeconds = 60) {
        const now = Date.now();
        const windowMs = windowSeconds * 1000;

        // Auto-prune store if capacity reached
        if (this.store.size >= this.maxCapacity) {
            this.prune(now);
        }

        let record = this.store.get(key);

        if (!record || now > record.resetAt) {
            record = {
                count: 1,
                resetAt: now + windowMs,
            };
            this.store.set(key, record);
            return {
                allowed: true,
                count: 1,
                remainingTime: windowSeconds,
            };
        }

        record.count += 1;
        const remainingTime = Math.max(1, Math.ceil((record.resetAt - now) / 1000));

        if (record.count > maxAllowed) {
            return {
                allowed: false,
                count: record.count,
                remainingTime,
            };
        }

        return {
            allowed: true,
            count: record.count,
            remainingTime,
        };
    }

    /**
     * Prunes expired keys from store
     */
    prune(now = Date.now()) {
        for (const [key, val] of this.store.entries()) {
            if (now > val.resetAt) {
                this.store.delete(key);
            }
        }
        // If still full after pruning expired, remove oldest 20%
        if (this.store.size >= this.maxCapacity) {
            let removed = 0;
            const target = Math.floor(this.maxCapacity * 0.2);
            for (const key of this.store.keys()) {
                this.store.delete(key);
                removed++;
                if (removed >= target) break;
            }
        }
    }
}

export const fallbackLimiter = new BoundedFallbackRateLimiter(10000);
export default fallbackLimiter;
