import User from "../model/userSchema.js";
import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { redisClient } from "../config/redis.js";
import { sendAdminInviteEmail } from "../services/emailService.js";
import { isAdminEmail } from "../utils/adminUtils.js";

const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || process.env.BCRYPT_ROUNDS || "12", 10);

// GET /admin/users - List all users with telemetry
export const getAllUsers = async (req, res) => {
    try {
        const { search, role, page = 1, limit = 50 } = req.query;
        const query = {};

        if (search && typeof search === "string" && search.trim()) {
            const safeSearch = search.trim().slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { name: { $regex: safeSearch, $options: "i" } },
                { email: { $regex: safeSearch, $options: "i" } }
            ];
        }

        if (role && ["user", "admin"].includes(role)) {
            query.role = role;
        }

        const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

        const [users, total] = await Promise.all([
            User.find(query)
                .select("-password")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            User.countDocuments(query)
        ]);

        // Enrich with live Redis token usage
        const enrichedUsers = await Promise.all(
            users.map(async (u) => {
                let liveTokens = 0;
                try {
                    const key = `token-usage:${u._id}`;
                    const val = await redisClient.get(key);
                    liveTokens = Number(val || 0);
                } catch (e) {
                    // ignore
                }
                const obj = u.toObject();
                obj.liveTokens = liveTokens;
                return obj;
            })
        );

        res.status(200).json({
            users: enrichedUsers,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit))
        });
    } catch (err) {
        console.error("Admin getAllUsers error:", err);
        res.status(500).json({ message: "Failed to retrieve users" });
    }
};

// POST /admin/users - Directly create a user
export const createUser = async (req, res) => {
    try {
        const { name, email, password, role = "user", age } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existing = await User.findOne({ email: normalizedEmail });

        if (existing) {
            return res.status(409).json({ message: "A user with this email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        const newUser = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            age: age ? Number(age) : undefined,
            role: role === "admin" ? "admin" : "user",
            isVerified: true,
            authProvider: "local"
        });

        res.status(201).json({
            message: "User successfully created",
            user: {
                _id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                isVerified: newUser.isVerified,
                createdAt: newUser.createdAt
            }
        });
    } catch (err) {
        console.error("Admin createUser error:", err);
        res.status(500).json({ message: "Failed to create user" });
    }
};

// POST /admin/users/invite - Invite a user with auto-generated credentials
export const inviteUser = async (req, res) => {
    try {
        const { name, email, role = "user" } = req.body;

        if (!email) {
            return res.status(400).json({ message: "User email address is required" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        let user = await User.findOne({ email: normalizedEmail });

        if (user && user.isVerified) {
            return res.status(409).json({ message: "An active user with this email already exists" });
        }

        // Generate temporary password
        const tempPassword = `Thunder#${crypto.randomBytes(3).toString("hex")}!`;
        const hashedPassword = await bcrypt.hash(tempPassword, BCRYPT_SALT_ROUNDS);

        if (user) {
            user.name = name ? name.trim() : user.name;
            user.password = hashedPassword;
            user.role = role === "admin" ? "admin" : "user";
            user.isVerified = true;
            await user.save();
        } else {
            user = await User.create({
                name: name ? name.trim() : normalizedEmail.split("@")[0],
                email: normalizedEmail,
                password: hashedPassword,
                role: role === "admin" ? "admin" : "user",
                isVerified: true,
                authProvider: "local"
            });
        }

        // Dispatch dedicated admin invitation notice with temporary credentials
        let mailSent = false;
        try {
            await sendAdminInviteEmail(
                normalizedEmail,
                tempPassword,
                user.name
            );
            mailSent = true;
        } catch (mailErr) {
            console.warn("Invite email delivery note:", mailErr.message);
        }

        // VULN-06 Remediation: Never return plaintext temporary passwords in HTTP response bodies
        res.status(200).json({
            message: mailSent
                ? `User ${normalizedEmail} successfully invited. Login credentials sent to their email.`
                : `User ${normalizedEmail} successfully activated. Email service unavailable; please instruct user to reset their password via Forgot Password.`,
            emailSent: mailSent,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            }
        });
    } catch (err) {
        console.error("Admin inviteUser error:", err);
        res.status(500).json({ message: "Failed to invite user" });
    }
};

// DELETE /admin/users/:userId - Delete user and cascade their data
export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        if (userId === req.user._id.toString()) {
            return res.status(400).json({ message: "Security error: Admin cannot delete their own active account." });
        }

        const userToDelete = await User.findById(userId);
        if (!userToDelete) {
            return res.status(404).json({ message: "Target user not found" });
        }

        if (userToDelete.role === "admin" || (userToDelete.email && isAdminEmail(userToDelete.email))) {
            return res.status(403).json({ message: "Security error: Administrator accounts are protected and cannot be deleted." });
        }

        // Cascade delete user's chats and messages
        await Message.deleteMany({ userId: userToDelete._id });
        await Chat.deleteMany({ userId: userToDelete._id });

        // Clean Redis rate limit and token keys
        try {
            await redisClient.del(`token-usage:${userToDelete._id}`);
            await redisClient.del(`rate-limit:user:${userToDelete._id}`);
        } catch (e) {
            // ignore
        }

        await User.findByIdAndDelete(userId);

        res.status(200).json({
            message: `User ${userToDelete.email} and all associated telemetry have been permanently deleted.`
        });
    } catch (err) {
        console.error("Admin deleteUser error:", err);
        res.status(500).json({ message: "Failed to delete user" });
    }
};

// PATCH /admin/users/:userId/role - Change user role
export const updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role || !["user", "admin"].includes(role)) {
            return res.status(400).json({ message: "Invalid role. Role must be 'user' or 'admin'" });
        }

        if (userId === req.user._id.toString() && role !== "admin") {
            return res.status(400).json({ message: "Security error: You cannot revoke your own admin status" });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: "Target user not found" });
        }

        targetUser.role = role;
        await targetUser.save();

        res.status(200).json({
            message: `User role updated to ${role} successfully`,
            user: {
                _id: targetUser._id,
                email: targetUser.email,
                role: targetUser.role
            }
        });
    } catch (err) {
        console.error("Admin updateUserRole error:", err);
        res.status(500).json({ message: "Failed to update user role" });
    }
};

// PATCH /admin/users/:userId/reset-quota - Reset sliding-window token usage
export const resetUserQuota = async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: "Target user not found" });
        }

        try {
            await redisClient.del(`token-usage:${userId}`);
            await redisClient.del(`rate-limit:user:${userId}`);
        } catch (e) {
            // ignore
        }

        res.status(200).json({
            message: `Token consumption and rate limits reset for ${targetUser.email}`
        });
    } catch (err) {
        console.error("Admin resetUserQuota error:", err);
        res.status(500).json({ message: "Failed to reset user quota" });
    }
};

// GET /admin/stats - System telemetry overview
export const getAdminStats = async (req, res) => {
    try {
        const [totalUsers, adminCount, totalChats, totalMessages] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: "admin" }),
            Chat.countDocuments(),
            Message.countDocuments()
        ]);

        const tokenAggregation = await User.aggregate([
            { $group: { _id: null, totalTokens: { $sum: "$usage.totalTokenUsed" } } }
        ]);

        const totalTokensUsed = tokenAggregation[0]?.totalTokens || 0;

        res.status(200).json({
            totalUsers,
            adminCount,
            totalChats,
            totalMessages,
            totalTokensUsed,
            governanceStatus: "OPERATIONAL",
            slidingWindowSeconds: Number(process.env.TOKEN_WINDOW_SECONDS || 18000),
            tokenLimit: Number(process.env.TOKEN_LIMIT || 10000)
        });
    } catch (err) {
        console.error("Admin getAdminStats error:", err);
        res.status(500).json({ message: "Failed to retrieve telemetry stats" });
    }
};
