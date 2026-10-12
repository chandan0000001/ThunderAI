import User from "../model/userSchema.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { signupSchema, loginSchema } from "../validators/userValidator.js";
import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import { redisClient } from "../config/redis.js";
import { sendVerificationOTP } from "../services/emailService.js";

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

    const token = jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
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

        if (existingUser && existingUser.isVerified) {
            return res.status(409).json({
                message: "An account with this email already exists. Please sign in."
            });
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
        try {
            await sendVerificationOTP(normalizedEmail, otp, name);
        } catch (mailErr) {
            console.error("Failed to dispatch verification email:", mailErr.message);
            return res.status(500).json({
                message: mailErr.message || "Failed to dispatch verification email. Please check your Gmail SMTP settings."
            });
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

        if (storedOtp !== normalizedOtp) {
            return res.status(400).json({
                message: "Invalid verification code. Please check your inbox and try again."
            });
        }

        // OTP verified! Invalidate stored OTP & cooldown
        await redisClient.del(`otp:${normalizedEmail}`);
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

        await sendVerificationOTP(normalizedEmail, otp, user.name);

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
                console.warn("Failed to dispatch OTP during login:", mailErr.message);
            }

            return res.status(403).json({
                message: "Your email is not verified yet. We have sent a new 6-digit code to your inbox.",
                requiresVerification: true,
                email: existingUser.email
            });
        }

        const token = createToken(existingUser._id, existingUser.email);
        res.cookie("token", token, cookiesOption);

        res.status(200).json({
            message: "User Logged in Successfully",
            name: existingUser.name,
            age: existingUser.age,
            email: existingUser.email,
            usage: existingUser.usage,
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

        res.clearCookie("token",{
            httpOnly: true,
            secure: false,
        })

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
            usage: {
                totalTokenUsed: req.user.usage?.totalTokenUsed || 0,
                tokenUsed: redisTokens,
                tokenLimit: Number(process.env.TOKEN_LIMIT || 10000),
                windowSeconds: Number(process.env.TOKEN_WINDOW_SECONDS || 18000),
                ttl: ttl > 0 ? ttl : 0
            },
            email: req.user.email
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
        secure: false,
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
