import User from "../model/userSchema.js";

const loadUserMiddleware = async (req, res, next) => {
    try {
        const existingUser = await User.findById(req.userId);

        if (!existingUser) {
            return res.status(404).json({
                message: "User doesn't exist"
            });
        }

        // VULN-04: Privilege escalation guard - Admin roles are strictly provisioned
        // via seedAdmin script or designated admin endpoints, never via silent auto-promote in hot middleware.

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
