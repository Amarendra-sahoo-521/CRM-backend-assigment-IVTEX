import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import leadRoutes from "./lead.routes";
import customerRoutes from "./customer.routes";
import dealRoutes from "./deal.routes";
import activityRoutes from "./activity.routes";
import analyticsRoutes from "./analytics.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/leads", leadRoutes);
router.use("/customers", customerRoutes);
router.use("/deals", dealRoutes);
router.use("/activities", activityRoutes);
router.use("/analytics", analyticsRoutes);

export default router;