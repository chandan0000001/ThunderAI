import express from "express";
import authUserMiddleware from "../middleware/authUserMiddleware.js";
import { getMessage, sendMessage, sendMessageStream } from "../controllers/messageController.js";
import authenticatedRateLimiter from '../middleware/authenticatedRateLimiter.js';
import tokenUsageMiddleware from "../middleware/tokenUsageMiddleware.js";
import loadUserMiddleware from "../middleware/loadUserMiddleware.js";
const messageRouter = express.Router();

messageRouter.use(authUserMiddleware);
messageRouter.use(authenticatedRateLimiter);

// Streaming routes
messageRouter.post("/stream", tokenUsageMiddleware, loadUserMiddleware, sendMessageStream);
messageRouter.post("/:chatId/stream", tokenUsageMiddleware, loadUserMiddleware, sendMessageStream);

// Non-streaming fallback routes
messageRouter.post("/", tokenUsageMiddleware, loadUserMiddleware, sendMessage);
messageRouter.get("/:chatId", loadUserMiddleware, getMessage);
messageRouter.post("/:chatId", tokenUsageMiddleware, loadUserMiddleware, sendMessage);







export default messageRouter;