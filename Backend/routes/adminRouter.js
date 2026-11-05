import express from "express";
import authUserMiddleware from "../middleware/authUserMiddleware.js";
import loadUserMiddleware from "../middleware/loadUserMiddleware.js";
import adminMiddleware from "../middleware/adminMiddleware.js";
import {
    getAllUsers,
    createUser,
    inviteUser,
    deleteUser,
    updateUserRole,
    resetUserQuota,
    getAdminStats
} from "../controllers/adminController.js";

const adminRouter = express.Router();

// All admin routes require authentication, user loading, and admin role verification
adminRouter.use(authUserMiddleware);
adminRouter.use(loadUserMiddleware);
adminRouter.use(adminMiddleware);

adminRouter.get("/users", getAllUsers);
adminRouter.post("/users", createUser);
adminRouter.post("/users/invite", inviteUser);
adminRouter.delete("/users/:userId", deleteUser);
adminRouter.patch("/users/:userId/role", updateUserRole);
adminRouter.patch("/users/:userId/reset-quota", resetUserQuota);
adminRouter.get("/stats", getAdminStats);

export default adminRouter;
