import User from "../model/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { signupSchema, loginSchema } from "../validators/userValidator.js";
import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import { redisClient } from "../config/redis.js";
import { sendVerificationOTP, sendPasswordResetEmail } from "../services/emailService.js";
import { isAdminEmail } from "../utils/adminUtils.js";
import { isAllowedOrigin } from "../utils/originUtils.js";
import {
    generateAccessToken,
    setAuthCookies,
    clearAuthCookies,
    rotateRefreshToken,
    getAccessTokenCookieOptions,
    getRefreshTokenCookieOptions,
    getRefreshTokenTTLSeconds
} from "../services/tokenService.js";

const googleClient = new OAuth2Client();

const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || process.env.BCRYPT_ROUNDS || "12", 10);

const createToken = (id, email, tokenVersion = 0) => {
    return generateAccessToken({ _id: id, email, tokenVersion });
};

const isProduction = process.env.NODE_ENV === "production";

export const signup = async (req, res) => {
    try {
        const result = signupSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                message: result.error.issues[0].message
            });
        }

        const { name, age, email, password } = result.data;
        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            if (existingUser.authProvider === "google") {
                return res.status(409).json({
                    message: "A user with this email already exists and was registered with Google. Please use 'Sign in with Google' to continue."
                });
            }
            if (existingUser.isVerified) {
                return res.status(409).json({
                    message: "A user with this email already exists. Please sign in."
                });
            }
        }

        const hashPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        if (existingUser && !existingUser.isVerified) {
            // User registered earlier but never completed OTP verification: update credentials
            existingUser.name = name;
            existingUser.age = age;
            existingUser.password = hashPassword;
            await existingUser.save();
        } else {
            await User.create({
                name,
                age,
                email: normalizedEmail,
                password: hashPassword,
                isVerified: false
            });
        }

        // Generate secure 6-digit OTP
        const otp = crypto.randomInt(100000, 1000000).toString();

        // Cache in Redis: 10 minutes OTP lifespan + 60s cooldown
        await redisClient.set(`otp:${normalizedEmail}`, otp, { EX: 600 });
        await redisClient.set(`otp_cooldown:${normalizedEmail}`, "1", { EX: 60 });

        // Dispatch verification email
        try {
            await sendVerificationOTP(normalizedEmail, otp, name);
        } catch (mailErr) {
            console.error(`[EmailService] Failed to dispatch signup OTP to ${normalizedEmail}:`, mailErr.message);
            return res.status(503).json({
                message: "Unable to deliver verification code to your email address at this time. Please check your email or try again in a few moments.",
                error: mailErr.message
            });
        }

        if (process.env.NODE_ENV !== "production") {
            console.log(`[EmailService] Generated signup OTP for ${normalizedEmail}: ${otp}`);
        }

        return res.status(200).json({
            message: "A 6-digit verification code has been dispatched to your email address.",
            email: normalizedEmail,
            requiresVerification: true
        });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({
            message: "Internal Server error during signup"
        });
    }
};

export const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and 6-digit verification code are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedOtp = otp.toString().trim();

        const storedOtp = await redisClient.get(`otp:${normalizedEmail}`);

        if (!storedOtp) {
            return res.status(400).json({
                message: "Verification code has expired or was not requested. Please click resend."
            });
        }

        // V-05: Brute-force protection with max 5 failed attempts per email
        const attemptKey = `otp-attempts:${normalizedEmail}`;
        if (storedOtp !== normalizedOtp) {
            const attempts = await redisClient.incr(attemptKey);
            if (attempts === 1) await redisClient.expire(attemptKey, 600); // 10 min window
            if (attempts >= 5) {
                await redisClient.del(`otp:${normalizedEmail}`);
                await redisClient.del(attemptKey);
                return res.status(429).json({
                    message: "Too many failed attempts. This code has been invalidated. Please request a new code."
                });
            }
            return res.status(400).json({
                message: `Invalid verification code. (${5 - attempts} attempts remaining)`
            });
        }

        // OTP verified! Invalidate stored OTP, attempt counter & cooldown
        await redisClient.del(`otp:${normalizedEmail}`);
        await redisClient.del(attemptKey);
        await redisClient.del(`otp_cooldown:${normalizedEmail}`);

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                message: "User account not found"
            });
        }

        user.isVerified = true;
        await user.save();

        await setAuthCookies(res, user);

        return res.status(200).json({
            message: "Email successfully verified! Welcome to Thunder AI.",
            name: user.name,
            age: user.age,
            email: user.email,
            usage: user.usage,
            isVerified: true
        });
    } catch (err) {
        console.error("Verify OTP error:", err);
        return res.status(500).json({
            message: "Internal Server Error during OTP verification"
        });
    }
};

export const resendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                message: "Email address is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // 60-second cooldown check to prevent mail spam
        const inCooldown = await redisClient.get(`otp_cooldown:${normalizedEmail}`);
        if (inCooldown) {
            return res.status(429).json({
                message: "Please wait 60 seconds before requesting another code."
            });
        }

        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({
                message: "No account found with this email address"
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                message: "This account is already verified. Please sign in."
            });
        }

        const otp = crypto.randomInt(100000, 1000000).toString();
        await redisClient.set(`otp:${normalizedEmail}`, otp, { EX: 600 });
        await redisClient.set(`otp_cooldown:${normalizedEmail}`, "1", { EX: 60 });

        try {
            await sendVerificationOTP(normalizedEmail, otp, user.name);
        } catch (mailErr) {
            console.error(`[EmailService] Failed to dispatch resent OTP to ${normalizedEmail}:`, mailErr.message);
            return res.status(503).json({
                message: "Unable to deliver verification code to your email address. Please try again in a few moments.",
                error: mailErr.message
            });
        }

        if (process.env.NODE_ENV !== "production") {
            console.log(`[EmailService] Resent OTP for ${normalizedEmail}: ${otp}`);
        }

        return res.status(200).json({
            message: "A new 6-digit verification code has been dispatched to your email.",
            requiresVerification: true
        });
    } catch (err) {
        console.error("Resend OTP error:", err);
        return res.status(500).json({
            message: "Failed to resend verification code. Please try again."
        });
    }
};

export const login = async (req, res) => {
    try {
        const result = loginSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                message: result.error.issues[0].message
            });
        }

        const { email, password } = result.data;
        const normalizedEmail = email.trim().toLowerCase();

        const existingUser = await User.findOne({ email: normalizedEmail });

        if (!existingUser) {
            return res.status(401).json({ message: "Invalid Credentials" });
        }

        // If user registered with Google and has no local password
        if (!existingUser.password && existingUser.authProvider === "google") {
            return res.status(400).json({
                message: "This account was registered with Google. Please use 'Sign in with Google' or use 'Forgot Password?' to set a password."
            });
        }

        const isMatch = await bcrypt.compare(password, existingUser.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid Credentials" });
        }

        // If user is not verified, dispatch fresh OTP and demand verification
        if (!existingUser.isVerified) {
            const otp = crypto.randomInt(100000, 1000000).toString();
            await redisClient.set(`otp:${normalizedEmail}`, otp, { EX: 600 });
            await redisClient.set(`otp_cooldown:${normalizedEmail}`, "1", { EX: 60 });

            try {
                await sendVerificationOTP(normalizedEmail, otp, existingUser.name);
            } catch (mailErr) {
                console.error(`[EmailService] Failed to dispatch login OTP to ${normalizedEmail}:`, mailErr.message);
                return res.status(503).json({
                    message: "Account requires email verification, but we could not deliver an email verification code at this time. Please try again shortly."
                });
            }

            if (process.env.NODE_ENV !== "production") {
                console.log(`[EmailService] Login OTP for ${normalizedEmail}: ${otp}`);
            }

            return res.status(403).json({
                message: "Your email is not verified yet. We have sent a new 6-digit code to your inbox.",
                requiresVerification: true,
                email: existingUser.email
            });
        }

        const isAdmin = existingUser.role === "admin";

        await setAuthCookies(res, existingUser);

        res.status(200).json({
            message: "User Logged in Successfully",
            _id: existingUser._id,
            name: existingUser.name,
            age: existingUser.age,
            email: existingUser.email,
            avatar: existingUser.avatar || "",
            role: existingUser.role || "user",
            isUnlimited: isAdmin,
            usage: {
                totalTokenUsed: existingUser.usage?.totalTokenUsed || 0,
                tokenUsed: 0,
                tokenLimit: isAdmin ? -1 : Number(process.env.TOKEN_LIMIT || 10000),
                isUnlimited: isAdmin
            },
            isVerified: true
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }
};



export const logout = async (req, res) => {
    try {
        await clearAuthCookies(req, res);
        return res.status(200).json({
            message: "User Logged Out Successfully"
        });
    } catch (error) {
        console.error("Logout error:", error);
        if (error.code === "REVOCATION_UNAVAILABLE" || error.code === "REVOCATION_FAILED") {
            return res.status(503).json({
                message: "Service unavailable: unable to confirm server-side session revocation. Please try again."
            });
        }
        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

/**
 * Section 4: Refresh Token Rotation & Reuse Detection Endpoint
 * POST /user/refresh
 * Restricts browser refresh token input strictly to the HttpOnly cookie.
 */
export const refreshToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({
                message: "Refresh token is missing"
            });
        }

        const result = await rotateRefreshToken(token);

        res.cookie("token", result.accessToken, getAccessTokenCookieOptions());
        res.cookie(
            "refreshToken",
            result.refreshToken,
            getRefreshTokenCookieOptions(result.remainingTTL ? result.remainingTTL * 1000 : null)
        );

        return res.status(200).json({
            message: "Session refreshed successfully",
            user: {
                _id: result.user._id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role || "user"
            }
        });
    } catch (err) {
        // F-19 Remediation: If database is unavailable, fail closed with 503 without clearing active cookies
        if (err.code === "SERVICE_UNAVAILABLE" || err.code === "DATABASE_UNAVAILABLE") {
            return res.status(503).json({
                message: "Authentication service temporarily unavailable: database offline."
            });
        }

        const clearOpts = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/"
        };
        res.clearCookie("token", clearOpts);
        res.clearCookie("refreshToken", clearOpts);

        if (err.code === "TOKEN_REUSE") {
            return res.status(401).json({
                message: "Security alert: Token reuse detected. All active sessions have been revoked. Please sign in again."
            });
        }

        return res.status(401).json({
            message: err.message || "Failed to refresh session. Please sign in again."
        });
    }
};




export const profile = async(req,res)=>{
    try{
        const isAdmin = req.user.role === "admin";

        let redisTokens = 0;
        let ttl = 0;
        try {
            const key = `token-usage:${req.user._id}`;
            const val = await redisClient.get(key);
            redisTokens = Number(val || 0);
            ttl = await redisClient.ttl(key);
        } catch (e) {
            console.log("Redis token read error:", e);
        }

        res.status(200).json({
            name: req.user.name,
            age: req.user.age,
            email: req.user.email,
            avatar: req.user.avatar || "",
            role: req.user.role || "user",
            authProvider: req.user.authProvider || "local",
            isUnlimited: isAdmin,
            usage: {
                totalTokenUsed: req.user.usage?.totalTokenUsed || 0,
                tokenUsed: redisTokens,
                tokenLimit: isAdmin ? -1 : Number(process.env.TOKEN_LIMIT || 10000),
                isUnlimited: isAdmin,
                windowSeconds: Number(process.env.TOKEN_WINDOW_SECONDS || 18000),
                ttl: ttl > 0 ? ttl : 0
            }
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message: "Internal Server error"
        });
    }
}



export const deleteAccount = async(req,res)=>{
    try{
        if (req.user?.role === "admin" || (req.user?.email && isAdminEmail(req.user.email))) {
            return res.status(403).json({
                message: "Administrator accounts are protected and cannot be deleted."
            });
        }

        //find all the chat ID which belongs to the user 

        //delete all the message whic belongs to chat ID 


        //delete all the chat ID  which belongs to the user 


        //delete user profile 

        const userId = req.user._id;
          
         await Message.deleteMany({
            userId
         });
          
         await Chat.deleteMany({
              userId
         });
          
         await User.deleteOne({
                _id: userId
         });
          
      try {
        await redisClient.del(`token-usage:${userId}`);
        await redisClient.del(`rate-limit:user:${userId}`);
        await redisClient.del(`user:tokenVersion:${userId}`);
      } catch (redisErr) {
        console.warn("Could not delete redis keys on account purge:", redisErr);
      }

      await clearAuthCookies(req, res);

      return res.status(200).json({
        message: "Account deleted successfully",
      });
        


    }catch(err){
        res.status(500).json({

         message:"Internation server error"
       })
    }
}

export const googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                message: "Google credential token is required"
            });
        }

        // VULN-03 Remediation: Strictly enforce GOOGLE_CLIENT_ID configuration and token audience verification
        const googleClientId = process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : null;
        if (!googleClientId) {
            return res.status(500).json({
                message: "Google OAuth authentication is not configured on this server (GOOGLE_CLIENT_ID missing)."
            });
        }

        let payload = null;

        // Verify ID token with google-auth-library
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: googleClientId,
            });
            payload = ticket.getPayload();
            if (payload && payload.aud !== googleClientId) {
                return res.status(401).json({ message: "Invalid Google credential audience" });
            }
        } catch (verifyError) {
            // Fallback: verify via Google tokeninfo endpoint
            try {
                const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
                if (response.ok) {
                    payload = await response.json();
                    if (payload.aud !== googleClientId) {
                        return res.status(401).json({ message: "Invalid Google credential audience" });
                    }
                } else {
                    throw new Error("Tokeninfo check failed");
                }
            } catch (fallbackError) {
                console.error("Google token verification failed:", verifyError.message, fallbackError.message);
                return res.status(401).json({
                    message: "Invalid or expired Google credential"
                });
            }
        }

        if (!payload || !payload.email) {
            return res.status(400).json({
                message: "Unable to retrieve email from Google profile"
            });
        }

        if (payload.email_verified === false || payload.email_verified === "false") {
            return res.status(403).json({
                message: "Google account email is not verified by Google"
            });
        }

        const normalizedEmail = payload.email.trim().toLowerCase();
        const googleId = payload.sub;
        let name = (payload.name || payload.given_name || normalizedEmail.split("@")[0] || "Thunder User").trim();
        if (name.length < 3) {
            name = `${name} User`;
        }
        name = name.slice(0, 50);
        const avatar = payload.picture || "";

        // Check if user already exists by googleId or email
        let user = await User.findOne({
            $or: [{ googleId: googleId }, { email: normalizedEmail }]
        });

        if (user) {
            // Update Google link and verify if not already
            if (!user.googleId) user.googleId = googleId;
            if (!user.avatar && avatar) user.avatar = avatar;
            user.isVerified = true;
            await user.save();
        } else {
            // Create new Google-authenticated user
            user = await User.create({
                name: name.slice(0, 50),
                email: normalizedEmail,
                googleId: googleId,
                avatar: avatar,
                authProvider: "google",
                isVerified: true
            });
        }

        const isAdmin = user.role === "admin";

        await setAuthCookies(res, user);

        return res.status(200).json({
            message: "Google login successful",
            _id: user._id,
            name: user.name,
            age: user.age,
            email: user.email,
            avatar: user.avatar,
            role: user.role || "user",
            isUnlimited: isAdmin,
            usage: {
                totalTokenUsed: user.usage?.totalTokenUsed || 0,
                tokenUsed: 0,
                tokenLimit: isAdmin ? -1 : Number(process.env.TOKEN_LIMIT || 10000),
                isUnlimited: isAdmin
            },
            isVerified: true
        });
    } catch (err) {
        console.error("Google auth error:", err);
        return res.status(500).json({
            message: "Internal Server Error during Google authentication"
        });
    }
};

// ==================== BYOK (Bring Your Own API Key) Handlers ====================

// POST /user/custom-api-key - Store custom API key(s) with 3-hour lease
export const setCustomApiKey = async (req, res) => {
    try {
        const { provider, apiKey } = req.body;
        if (!provider || !apiKey) {
            return res.status(400).json({
                message: "Provider and apiKey are required."
            });
        }

        const { saveUserApiKey } = await import("../services/keyManagerService.js");
        const result = await saveUserApiKey(req.userId, provider.toLowerCase(), apiKey);

        res.status(200).json({
            message: `API key for ${provider.toUpperCase()} saved successfully. Active for 3 hours of inactivity.`,
            ...result
        });
    } catch (err) {
        console.error("setCustomApiKey error:", err);
        res.status(400).json({ message: err.message || "Failed to save API key" });
    }
};

// GET /user/custom-api-key - List active custom keys
export const getCustomApiKeys = async (req, res) => {
    try {
        const { getUserConfiguredProviders } = await import("../services/keyManagerService.js");
        const providers = await getUserConfiguredProviders(req.userId);
        res.status(200).json({ providers });
    } catch (err) {
        console.error("getCustomApiKeys error:", err);
        res.status(500).json({ message: "Failed to retrieve active API keys" });
    }
};

// DELETE /user/custom-api-key/:provider - Remove custom API key
export const removeCustomApiKey = async (req, res) => {
    try {
        const { provider } = req.params;
        const { deleteUserApiKey } = await import("../services/keyManagerService.js");
        await deleteUserApiKey(req.userId, provider.toLowerCase());
        res.status(200).json({
            message: `API key for ${provider.toUpperCase()} has been cleared.`
        });
    } catch (err) {
        console.error("removeCustomApiKey error:", err);
        res.status(500).json({ message: "Failed to remove API key" });
    }
};

// POST /user/forgot-password - Send password reset link to user email via admin email
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== "string" || !email.trim()) {
            return res.status(400).json({ message: "Valid email address is required" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });

        // V-12: Constant response prevents user enumeration attacks
        if (!user) {
            return res.status(200).json({
                message: "If this email is registered, a password reset link has been dispatched to your inbox.",
                expiresInSeconds: 900
            });
        }

        // V-14: Invalidate previous active reset token for this email if any exists
        const emailResetKey = `password-reset-email:${normalizedEmail}`;
        const prevToken = await redisClient.get(emailResetKey);
        if (prevToken) {
            await redisClient.del(`password-reset:${prevToken}`);
        }

        // Generate high-entropy 32-byte cryptographic token
        const resetToken = crypto.randomBytes(32).toString("hex");

        // Store token with 15-minute expiration (900 seconds)
        const redisKey = `password-reset:${resetToken}`;
        await redisClient.set(redisKey, normalizedEmail, { EX: 900 });
        await redisClient.set(emailResetKey, resetToken, { EX: 900 });

        // VULN-07 & Host-Poisoning Guard: Derive verified origin and never leak email in reset URL
        const defaultOrigin = (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",")[0].trim() : "http://localhost:5173").replace(/\/$/, "");
        let baseOrigin = defaultOrigin;
        if (req.headers.origin && isAllowedOrigin(req.headers.origin)) {
            baseOrigin = req.headers.origin.trim().replace(/\/$/, "");
        }
        const resetUrl = `${baseOrigin}/reset-password?token=${resetToken}`;

        // Send email through admin email configured in env (via sendPasswordResetEmail)
        let emailSent = false;
        try {
            await sendPasswordResetEmail(normalizedEmail, resetUrl, user.name);
            emailSent = true;
        } catch (mailErr) {
            console.warn("Forgot password email delivery note:", mailErr.message);
        }

        // V-02: Never leak reset token in HTTP response
        if (!emailSent && process.env.NODE_ENV !== "production") {
            console.log(`[DEV ONLY] Reset Link for ${normalizedEmail}: ${resetUrl}`);
        }

        return res.status(200).json({
            message: "If this email is registered, a password reset link has been dispatched to your inbox.",
            expiresInSeconds: 900
        });
    } catch (err) {
        console.error("Forgot password error:", err);
        return res.status(500).json({ message: "Failed to process password reset request. Please try again." });
    }
};

// POST /user/reset-password - Verify token and update user password
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || typeof token !== "string" || !token.trim()) {
            return res.status(400).json({ message: "Reset token is required" });
        }

        if (!newPassword || typeof newPassword !== "string") {
            return res.status(400).json({ message: "New password is required" });
        }

        // Validate password complexity
        const hasMinLen = newPassword.length >= 8 && newPassword.length <= 30;
        const hasUpper = /[A-Z]/.test(newPassword);
        const hasLower = /[a-z]/.test(newPassword);
        const hasNum = /[0-9]/.test(newPassword);
        const hasSpecial = /[~!@#$%^&*():]/.test(newPassword);

        if (!hasMinLen || !hasUpper || !hasLower || !hasNum || !hasSpecial) {
            return res.status(400).json({
                message: "Password must be 8-30 characters with uppercase, lowercase, number, and special character."
            });
        }

        const redisKey = `password-reset:${token.trim()}`;

        // F-13 Remediation: Atomic one-time token redemption via Redis GETDEL or atomic Lua transaction.
        // Completely eliminates non-atomic GET-then-DEL application-space race conditions.
        let email = null;
        try {
            if (typeof redisClient.getDel === "function") {
                email = await redisClient.getDel(redisKey);
            } else {
                const atomicLua = "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]) end; return v;";
                email = await redisClient.eval(atomicLua, { keys: [redisKey] });
            }
        } catch {
            const atomicLua = "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]) end; return v;";
            email = await redisClient.eval(atomicLua, { keys: [redisKey] });
        }

        if (!email) {
            return res.status(400).json({
                message: "This password reset link is invalid or has expired. Please request a new one."
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User account not found." });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
        user.password = hashedPassword;
        user.isVerified = true;

        // F-20 Remediation: Invalidate old tokenVersion cache before incrementing
        const userCacheKey = `user:tokenVersion:${user._id.toString()}`;
        if (redisClient && redisClient.isOpen) {
            await redisClient.del(userCacheKey);
        }

        // F-07 Remediation: Increment tokenVersion to immediately revoke all existing active sessions
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        // Update active session cache in Redis to instantly reject existing JWTs across all devices
        if (redisClient && redisClient.isOpen) {
            await redisClient.set(userCacheKey, user.tokenVersion.toString(), {
                EX: getRefreshTokenTTLSeconds()
            });
        }

        // Invalidate lookup key
        await redisClient.del(`password-reset-email:${email}`);

        return res.status(200).json({
            message: "Password updated successfully! You can now sign in with your new password."
        });
    } catch (err) {
        console.error("Reset password error:", err);
        return res.status(500).json({ message: "Failed to reset password. Please try again." });
    }
};

/**
 * Returns the client's detected IP address and user-agent string for device governance telemetry.
 */
export const getClientInfo = async (req, res) => {
    try {
        const forwarded = req.headers["x-forwarded-for"];
        const rawIp = forwarded
            ? forwarded.split(",")[0].trim()
            : (req.socket?.remoteAddress || req.ip || "127.0.0.1");
        const clientIp = rawIp.replace(/^::ffff:/, "");
        return res.status(200).json({
            ip: clientIp,
            userAgent: req.headers["user-agent"] || "",
        });
    } catch {
        return res.status(200).json({ ip: "127.0.0.1" });
    }
};
