/**
 * Strict Origin Validation Utility for CORS and CSRF Protection
 */

export const getAllowedOrigins = () => {
    const allowed = new Set();

    if (process.env.CORS_ALLOWED_ORIGINS) {
        process.env.CORS_ALLOWED_ORIGINS.split(",").forEach((url) => {
            const trimmed = url.trim().replace(/\/$/, "");
            if (trimmed) allowed.add(trimmed);
        });
    }

    if (process.env.FRONTEND_URL) {
        process.env.FRONTEND_URL.split(",").forEach((url) => {
            const trimmed = url.trim().replace(/\/$/, "");
            if (trimmed) allowed.add(trimmed);
        });
    }

    // Known production deployment endpoints
    allowed.add("https://thunder-ai-mu.vercel.app");
    allowed.add("https://thunder-ai.pages.dev");

    // Local development origins
    const devOrigins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ];

    if (process.env.NODE_ENV !== "production") {
        devOrigins.forEach((origin) => allowed.add(origin));
    }

    return allowed;
};

export const isAllowedOrigin = (origin) => {
    if (!origin) return true; // Allow non-browser programmatic clients (cURL, health checks)
    const normalized = origin.trim().replace(/\/$/, "");
    const allowed = getAllowedOrigins();

    if (allowed.has(normalized)) return true;

    // Allow any localhost port in development
    if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
        return true;
    }

    return false;
};
