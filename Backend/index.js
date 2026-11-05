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

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://thunder-ai-mu.vercel.app"
];

if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL.split(",").forEach(url => {
        const trimmed = url.trim().replace(/\/$/, "");
        if (trimmed) allowedOrigins.push(trimmed);
    });
}

app.use(cors({
    origin: (origin, callback) => {
        if (
            !origin ||
            allowedOrigins.includes(origin) ||
            origin.endsWith(".pages.dev") ||
            origin.endsWith(".railway.app") ||
            origin.endsWith(".onrender.com") ||
            origin.endsWith(".vercel.app") ||
            origin.endsWith(".fly.dev") ||
            origin.includes("localhost") ||
            origin.includes("127.0.0.1")
        ) {
            return callback(null, true);
        }
        callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));

app.use(express.json());
app.use(cookieParser());

// Health check endpoint for Koyeb / uptime monitoring
app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Serve Frontend SPA assets in unified production mode
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    // Handle direct browser page navigation and refresh for frontend SPA routes (e.g. /chat/:chatId, /profile)
    app.use((req, res, next) => {
        if (
            req.method === "GET" &&
            req.headers.accept &&
            req.headers.accept.includes("text/html") &&
            !req.path.startsWith("/health")
        ) {
            return res.sendFile(path.join(frontendDistPath, "index.html"));
        }
        next();
    });
}

// API Routes
app.use("/user", userRouter);
app.use("/msg", messageRouter);
app.use("/chat", chatRouter);
app.use("/admin", adminRouter);

// Fallback for any other remaining unmatched GET routes in production
if (fs.existsSync(frontendDistPath)) {
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
