import { Router } from "express";
import * as ctrl from "../controllers/analytics.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ROLES } from "../constants";
import { analyticsQuerySchema, teamPerformanceQuerySchema } from "../validators/analytics.validator";

const router = Router();

router.use(authenticate);

router.get("/dashboard", validate(analyticsQuerySchema, "query"), ctrl.dashboard);
router.get("/pipeline", validate(analyticsQuerySchema, "query"), ctrl.pipeline);
router.get(
  "/team-performance",
  authorize(ROLES.ADMIN, ROLES.SALES_MANAGER),
  validate(teamPerformanceQuerySchema, "query"),
  ctrl.teamPerformance
);

export default router;