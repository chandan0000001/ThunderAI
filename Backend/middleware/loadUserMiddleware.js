import User from "../model/userSchema.js";
import { isAdminEmail } from "../utils/adminUtils.js";

const loadUserMiddleware = async (req, res, next) => {
    try {
        const existingUser = await User.findById(req.userId);

        if (!existingUser) {
            return res.status(404).json({
                message: "User doesn't exist"
            });
        }

        // Auto-grant admin role to verified admin email accounts configured in environment
        if (existingUser.email && isAdminEmail(existingUser.email) && existingUser.role !== "admin") {
            existingUser.role = "admin";
            existingUser.isVerified = true;
            await existingUser.save();
        }

        if (!existingUser.isVerified) {
            return res.status(403).json({
                message: "Your email is not verified. Please verify your email first.",
                requiresVerification: true,
                email: existingUser.email
            });
        }

        req.user = existingUser;

        next();
    } catch (error) {
        console.log("Load user error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

export default loadUserMiddleware;
