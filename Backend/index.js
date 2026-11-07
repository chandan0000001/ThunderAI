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

// Trust proxy for accurate client IP identification on Render / Vercel / Cloudflare
app.set("trust proxy", true);

// V-10: Helmet HTTP Security Headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://thunder-ai-mu.vercel.app"
];

if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL.split(",").forEach(url => {
        const trimmed = url.trim().replace(/\/$/, "");
        if (trimmed) allowedOrigins.push(trimmed);
    });
}

// V-01 & V-15: Strict Origin Validation with anchored Regex (No bypasses)
const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
    if (/^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(origin)) return true;
    if (/^https:\/\/([a-zA-Z0-9-]+\.)*onrender\.com$/.test(origin)) return true;
    if (/^https:\/\/([a-zA-Z0-9-]+\.)*pages\.dev$/.test(origin)) return true;
    return false;
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }
        return callback(new Error("CORS policy violation: origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With"]
}));

// V-18: Strict body size limit
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());

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
        await connectionDB();
        await connectRedis();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Thunder AI Server is running on port ${PORT}`);
        });

        // Test email configuration asynchronously in background (never blocks port binding)
        verifyEmailConfiguration().catch(() => {});

        // Auto-bootstrap Admin account from environment variables if provided
        if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            import("./model/userSchema.js").then(async ({ default: User }) => {
                const bcrypt = (await import("bcrypt")).default;
                const adminEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
                const existing = await User.findOne({ email: adminEmail });
                const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
                if (existing) {
                    existing.role = "admin";
                    existing.password = hash;
                    existing.isVerified = true;
                    await existing.save();
                    console.log(` Admin user ensured: ${adminEmail} (Role: admin)`);
                } else {
                    await User.create({
                        name: "Thunder Admin",
                        email: adminEmail,
                        password: hash,
                        role: "admin",
                        isVerified: true,
                        authProvider: "local"
                    });
                    console.log(` Admin user created: ${adminEmail} (Role: admin)`);
                }
            }).catch(e => console.warn("Admin bootstrap note:", e.message));
        }
    } catch (error) {
        console.error("Failed to connect. Please try again. ERROR:", error);
    }
};

startServer();

export default app;
