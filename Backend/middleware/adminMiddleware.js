const adminMiddleware = (req, res, next) => {
    try {
        if (!req.user || req.user.role !== "admin") {
            return res.status(403).json({
                message: "Access forbidden: System Administrator privileges required."
            });
        }
        next();
    } catch (error) {
        console.error("Admin middleware error:", error);
        return res.status(500).json({
            message: "Internal server error during authorization"
        });
    }
};

export default adminMiddleware;
