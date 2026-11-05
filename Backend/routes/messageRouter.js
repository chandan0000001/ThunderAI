import express from "express";
import authUserMiddleware from "../middleware/authUserMiddleware.js";
import { getMessage, sendMessage, sendMessageStream } from "../controllers/messageController.js";
import authenticatedRateLimiter from '../middleware/authenticatedRateLimiter.js';
import tokenUsageMiddleware from "../middleware/tokenUsageMiddleware.js";
import loadUserMiddleware from "../middleware/loadUserMiddleware.js";
const messageRouter = express.Router();

messageRouter.use(authUserMiddleware);
messageRouter.use(loadUserMiddleware);
messageRouter.use(authenticatedRateLimiter);

// Streaming routes
messageRouter.post("/stream", tokenUsageMiddleware, sendMessageStream);
messageRouter.post("/:chatId/stream", tokenUsageMiddleware, sendMessageStream);

// Non-streaming fallback routes
messageRouter.post("/", tokenUsageMiddleware, sendMessage);
messageRouter.get("/:chatId", getMessage);
messageRouter.post("/:chatId", tokenUsageMiddleware, sendMessage);

export default messageRouter;