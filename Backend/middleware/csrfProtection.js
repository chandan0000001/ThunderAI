import { isAllowedOrigin } from "../utils/originUtils.js";

/**
 * F-06 Remediation: Comprehensive CSRF Protection Middleware
 *
 * Enforces dual-layer defense against Cross-Site Request Forgery:
 * 1. Safe methods (GET, HEAD, OPTIONS) pass through.
 * 2. Origin & Referer Verification: State-changing requests (POST, PUT, DELETE, PATCH)
 *    sent with browser Origin/Referer headers MUST match the allowed origins list.
 * 3. Custom Header Enforcement: Cookie-authenticated state-changing requests must include
 *    a custom header ('X-Requested-With' or 'X-CSRF-Token'). Cross-origin HTML forms and scripts
 *    cannot attach custom headers without CORS preflight authorization.
 */
export const csrfProtection = (req, res, next) => {
    // 1. Safe methods are always exempt
    const safeMethods = ["GET", "HEAD", "OPTIONS"];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // 2. Origin / Referer Validation on state-changing requests
    const originHeader = req.headers.origin || req.headers.referer;
    if (originHeader) {
        let hostOrigin = originHeader;
        try {
            const parsed = new URL(originHeader);
            hostOrigin = `${parsed.protocol}//${parsed.host}`;
        } catch {
            // Keep raw if not parseable
        }

        if (!isAllowedOrigin(hostOrigin)) {
            console.warn(`[CSRF] Rejected request from untrusted origin: ${hostOrigin}`);
            return res.status(403).json({
                message: "CSRF verification failed: origin not authorized."
            });
        }
    }

    // 3. Cookie-authenticated state-changing requests require custom header proof
    const hasAuthCookie = Boolean(req.cookies && (req.cookies.token || req.cookies.refreshToken));
    if (hasAuthCookie) {
        const customHeader = req.headers["x-requested-with"] || req.headers["x-csrf-token"];
        if (!customHeader) {
            console.warn(`[CSRF] Rejected cookie-authenticated ${req.method} request missing X-Requested-With or X-CSRF-Token`);
            return res.status(403).json({
                message: "CSRF verification failed: missing required custom security header."
            });
        }
    }

    next();
};

export default csrfProtection;
