import express from "express"
import {
    login,
    signup,
    profile,
    logout,
    deleteAccount,
    verifyOTP,
    resendOTP,
    googleAuth,
    setCustomApiKey,
    getCustomApiKeys,
    removeCustomApiKey,
    forgotPassword,
    resetPassword,
    getClientInfo
} from "../controllers/userController.js";
import authUserMiddleware from '../middleware/authUserMiddleware.js';
import unauthenticatedRateLimiter from '../middleware/unauthenticatedRateLimiter.js';
import authenticatedRateLimiter from "../middleware/authenticatedRateLimiter.js";

import loadUserMiddleware from "../middleware/loadUserMiddleware.js";

const userRouter = express.Router();
userRouter.post("/login", unauthenticatedRateLimiter, login);
userRouter.post("/google-login", unauthenticatedRateLimiter, googleAuth);
userRouter.post("/logout", authUserMiddleware, logout);
userRouter.post("/signup", unauthenticatedRateLimiter, signup);
userRouter.post("/verify-otp", unauthenticatedRateLimiter, verifyOTP);
userRouter.post("/resend-otp", unauthenticatedRateLimiter, resendOTP);
userRouter.post("/forgot-password", unauthenticatedRateLimiter, forgotPassword);
userRouter.post("/reset-password", unauthenticatedRateLimiter, resetPassword);
userRouter.get("/client-info", getClientInfo);
userRouter.get("/profile", authUserMiddleware, authenticatedRateLimiter, loadUserMiddleware, profile);
userRouter.delete("/delete", authUserMiddleware, loadUserMiddleware, deleteAccount);

// BYOK (Bring Your Own API Key) routes with 3-hour lease
userRouter.get("/custom-api-key", authUserMiddleware, getCustomApiKeys);
userRouter.post("/custom-api-key", authUserMiddleware, setCustomApiKey);
userRouter.delete("/custom-api-key/:provider", authUserMiddleware, removeCustomApiKey);


export default userRouter;
