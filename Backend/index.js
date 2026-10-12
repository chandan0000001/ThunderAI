import dotenv from "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import connectionDB from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import userRouter from "./routes/userRouter.js";
import messageRouter from "./routes/messageRouter.js";
import chatRouter from "./routes/chatRouter.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../Frontend/dist");

const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000"
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
}

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
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

// Health check endpoint for Render / monitoring
app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/user", userRouter);
app.use("/msg", messageRouter);
app.use("/chat", chatRouter);

// Serve Frontend SPA assets in unified production mode
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    app.get("*", (req, res) => {
        res.sendFile(path.join(frontendDistPath, "index.html"));
    });
}

const startServer = async () => {
    try {
        await connectionDB();
        await connectRedis();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`⚡ Thunder AI Server is running at http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to connect. Please try again. ERROR:", error);
    }
};

startServer();
