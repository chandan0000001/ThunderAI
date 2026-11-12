import express from "express";
import multer from "multer";
import authUserMiddleware from "../middleware/authUserMiddleware.js";
import { getMessage, sendMessage, sendMessageStream, uploadDocument } from "../controllers/messageController.js";
import authenticatedRateLimiter from '../middleware/authenticatedRateLimiter.js';
import tokenUsageMiddleware from "../middleware/tokenUsageMiddleware.js";
import loadUserMiddleware from "../middleware/loadUserMiddleware.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(pdf|txt|md|json|csv|png|jpg|jpeg|webp)$/i;
    if (file.originalname && file.originalname.match(allowedExtensions)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload a PDF, TXT, MD, JSON, CSV, or Image (PNG, JPG, WEBP)."));
    }
  },
});

const messageRouter = express.Router();

messageRouter.use(authUserMiddleware);
messageRouter.use(loadUserMiddleware);
messageRouter.use(authenticatedRateLimiter);

// Attachment upload route (Option B: BullMQ background processing)
messageRouter.post("/upload", upload.single("file"), uploadDocument);

// Streaming routes
messageRouter.post("/stream", tokenUsageMiddleware, sendMessageStream);
messageRouter.post("/:chatId/stream", tokenUsageMiddleware, sendMessageStream);

// Non-streaming fallback routes
messageRouter.post("/", tokenUsageMiddleware, sendMessage);
messageRouter.get("/:chatId", getMessage);
messageRouter.post("/:chatId", tokenUsageMiddleware, sendMessage);

export default messageRouter;