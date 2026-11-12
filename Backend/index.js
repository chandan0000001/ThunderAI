import "dotenv/config";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../Frontend/dist");

dotenv.config({ path: path.resolve(__dirname, ".env") });

import connectionDB from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { verifyEmailConfiguration } from "./services/emailService.js";
import userRouter from "./routes/userRouter.js";
import messageRouter from "./routes/messageRouter.js";
import chatRouter from "./routes/chatRouter.js";
import adminRouter from "./routes/adminRouter.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

const app = express();

// Trust exactly 1 upstream proxy hop (Render / Railway / Cloudflare / Vercel)
// Preventing X-Forwarded-For spoofing attacks (CWE-290 / VULN-02)
app.set("trust proxy", 1);

// HTTP Security Headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

import { isAllowedOrigin } from "./utils/originUtils.js";
import csrfProtection from "./middleware/csrfProtection.js";

export { isAllowedOrigin };

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }
        return callback(new Error("CORS policy violation: origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With", "X-CSRF-Token"]
}));

// V-18: Strict body size limit
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

// F-06 Remediation: Enforce CSRF protection on state-changing requests
app.use(csrfProtection);

// Disable ETags and enforce no-cache for real-time dynamic API routes (avoids stale 304s on chats/messages)
app.set("etag", false);
app.use((req, res, next) => {
    if (
        req.path.startsWith("/user") ||
        req.path.startsWith("/msg") ||
        req.path.startsWith("/chat") ||
        req.path.startsWith("/admin")
    ) {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
    }
    next();
});

// Health check endpoint for Koyeb / uptime monitoring
app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/user", userRouter);
app.use("/msg", messageRouter);
app.use("/chat", chatRouter);
app.use("/admin", adminRouter);

// Serve Frontend SPA assets in unified production mode
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    // Fallback for frontend SPA navigation
    app.use((req, res) => {
        res.sendFile(path.join(frontendDistPath, "index.html"));
    });
}

const startServer = async () => {
    try {
        // F-23 Remediation: Validate JWT secret and token TTL configurations at application bootstrap
        const { validateTokenConfig } = await import("./services/tokenService.js");
        validateTokenConfig();

        if (!process.env.MONGO_URI) {
            throw new Error("Critical startup failure: MONGO_URI is not configured.");
        }

        await connectionDB();
        await connectRedis();

        // Validate BYOK encryption key configuration
        const { validateKeyManagerConfig } = await import("./services/keyManagerService.js");
        validateKeyManagerConfig();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Thunder AI Server is running on port ${PORT}`);
        });

        // Test email configuration asynchronously in background (never blocks port binding)
        verifyEmailConfiguration().catch(() => {});

        // F-12 Remediation: Administrator account creation/promotion is strictly separated
        // from ordinary application startup and managed via explicit audited command (npm run seed:admin).
    } catch (error) {
        console.error("Failed to connect. Please try again. ERROR:", error);
    }
};

startServer();

export default app;
