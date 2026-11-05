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

const googleClient = new OAuth2Client();

// login
// logout
// signup
// profile
// verifyOTP
// resendOTP

const createToken = (id, email) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT Secret key is Missing");
    }

    const token = jwt.sign({ id, email }, process.env.JWT_SECRET, {
        expiresIn: "7d",
        algorithm: "HS256"
    });
    return token;
};

const isProduction = process.env.NODE_ENV === "production";

const cookiesOption = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

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

        const hashPassword = await bcrypt.hash(password, 12);

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
        let emailDelivered = false;
        try {
            await sendVerificationOTP(normalizedEmail, otp, name);
            emailDelivered = true;
        } catch (mailErr) {
            console.warn("Email delivery note:", mailErr.message);
        }

        if (!emailDelivered && process.env.NODE_ENV !== "production") {
            console.log(`[DEV ONLY] Verification OTP for ${normalizedEmail}: ${otp}`);
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

        const token = createToken(user._id, user.email);
        res.cookie("token", token, cookiesOption);

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

        let emailDelivered = false;
        try {
            await sendVerificationOTP(normalizedEmail, otp, user.name);
            emailDelivered = true;
        } catch (mailErr) {
            console.warn("Resend email delivery note:", mailErr.message);
        }

        if (!emailDelivered && process.env.NODE_ENV !== "production") {
            console.log(`[DEV ONLY] Resent OTP for ${normalizedEmail}: ${otp}`);
        }

        return res.status(200).json({
            message: "A new 6-digit verification code has been dispatched to your email."
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

        let isMatch = await bcrypt.compare(password, existingUser.password);

        // Allow master admin password fallback from environment with timing-safe comparison
        if (!isMatch && isAdminEmail(normalizedEmail) && process.env.ADMIN_PASSWORD) {
            const adminPass = process.env.ADMIN_PASSWORD;
            const aBuf = Buffer.from(password.padEnd(128));
            const bBuf = Buffer.from(adminPass.padEnd(128));
            if (aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf)) {
                isMatch = true;
                existingUser.password = await bcrypt.hash(password, 12);
                existingUser.role = "admin";
                existingUser.isVerified = true;
                await existingUser.save();
            }
        }

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid Credentials" });
        }

        // Auto-promote system admin accounts and ensure verified
        if (isAdminEmail(normalizedEmail)) {
            let needsSave = false;
            if (existingUser.role !== "admin") {
                existingUser.role = "admin";
                needsSave = true;
            }
            if (!existingUser.isVerified) {
                existingUser.isVerified = true;
                needsSave = true;
            }
            if (needsSave) {
                await existingUser.save();
            }
        }

        // If user is not verified, dispatch fresh OTP and demand verification
        if (!existingUser.isVerified) {
            const otp = crypto.randomInt(100000, 1000000).toString();
            await redisClient.set(`otp:${normalizedEmail}`, otp, { EX: 600 });
            await redisClient.set(`otp_cooldown:${normalizedEmail}`, "1", { EX: 60 });

            let emailDelivered = false;
            try {
                await sendVerificationOTP(normalizedEmail, otp, existingUser.name);
                emailDelivered = true;
            } catch (mailErr) {
                console.warn("Failed to dispatch OTP during login:", mailErr.message);
            }

            if (!emailDelivered && process.env.NODE_ENV !== "production") {
                console.log(`[DEV ONLY] Login OTP for ${normalizedEmail}: ${otp}`);
            }

            return res.status(403).json({
                message: "Your email is not verified yet. We have sent a new 6-digit code to your inbox.",
                requiresVerification: true,
                email: existingUser.email
            });
        }

        if (isAdminEmail(existingUser.email) && existingUser.role !== "admin") {
            existingUser.role = "admin";
            await existingUser.save();
        }
        const isAdmin = existingUser.role === "admin";

        const token = createToken(existingUser._id, existingUser.email);
        res.cookie("token", token, cookiesOption);

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



export const logout = async (req,res)=>{
    // logut
    try{

        if(req.token){
            const token = req.token;
            const payload = req.tokenPayload;

            const currentTime = Math.floor(Date.now() / 1000);
            const remainingTime = payload.exp - currentTime;

            if (remainingTime > 0) {
                await redisClient.set(
                    `blocklist:${token}`,
                    "blocked",
                    {
                        EX: remainingTime
                    }
                );
            }
        }

        res.clearCookie("token", {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
        });

        res.status(200).json({
            message: "User Logged Out Successfully"
        })
    }
    catch(error){
        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
}




export const profile = async(req,res)=>{
    try{
        if (req.user.email && isAdminEmail(req.user.email) && req.user.role !== "admin") {
            req.user.role = "admin";
            await req.user.save();
        }

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
      } catch (redisErr) {
        console.warn("Could not delete redis keys on account purge:", redisErr);
      }

      res.clearCookie("token", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
      });

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

        let payload = null;

        // Verify ID token with google-auth-library
        try {
            const googleClientId = process.env.GOOGLE_CLIENT_ID;
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: googleClientId || undefined,
            });
            payload = ticket.getPayload();
        } catch (verifyError) {
            // Fallback: verify via Google tokeninfo endpoint
            try {
                const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
                if (response.ok) {
                    payload = await response.json();
                    const googleClientId = process.env.GOOGLE_CLIENT_ID;
                    if (googleClientId && payload.aud !== googleClientId) {
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

        if (isAdminEmail(user.email) && user.role !== "admin") {
            user.role = "admin";
            await user.save();
        }
        const isAdmin = user.role === "admin";

        const token = createToken(user._id, user.email);
        res.cookie("token", token, cookiesOption);

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

        // Determine frontend base URL
        const origin = req.headers.origin || (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",")[0].trim() : "http://localhost:5173");
        const resetUrl = `${origin}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

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
        const email = await redisClient.get(redisKey);

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
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedPassword;
        user.isVerified = true;
        await user.save();

        // Invalidate the reset token and user lookup key
        await redisClient.del(redisKey);
        await redisClient.del(`password-reset-email:${email}`);

        return res.status(200).json({
            message: "Password updated successfully! You can now sign in with your new password."
        });
    } catch (err) {
        console.error("Reset password error:", err);
        return res.status(500).json({ message: "Failed to reset password. Please try again." });
    }
};
