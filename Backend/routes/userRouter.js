import express from "express"
import { login, signup, profile, logout, deleteAccount, verifyOTP, resendOTP } from "../controllers/userController.js";
import authUserMiddleware from '../middleware/authUserMiddleware.js';
import unauthenticatedRateLimiter from '../middleware/unauthenticatedRateLimiter.js';
import authenticatedRateLimiter from "../middleware/authenticatedRateLimiter.js";

import loadUserMiddleware from "../middleware/loadUserMiddleware.js";

const userRouter = express.Router();
userRouter.post("/login", unauthenticatedRateLimiter, login);
userRouter.post("/logout", authUserMiddleware, logout);
userRouter.post("/signup", unauthenticatedRateLimiter, signup);
userRouter.post("/verify-otp", unauthenticatedRateLimiter, verifyOTP);
userRouter.post("/resend-otp", unauthenticatedRateLimiter, resendOTP);
userRouter.get("/profile", authUserMiddleware, authenticatedRateLimiter, loadUserMiddleware, profile);
userRouter.delete("/delete", authUserMiddleware, loadUserMiddleware, deleteAccount);


export default userRouter;
