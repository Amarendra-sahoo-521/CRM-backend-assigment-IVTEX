import { Router } from "express";
import * as ctrl from "../controllers/activity.controller";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { idParamSchema } from "../validators/common";
import {
  createActivitySchema, updateActivitySchema, listActivitiesQuerySchema,
} from "../validators/activity.validator";

const router = Router();
const id = validate(idParamSchema, "params");

router.use(authenticate);

router.post("/", validate(createActivitySchema), ctrl.create);
router.get("/", validate(listActivitiesQuerySchema, "query"), ctrl.list);
router.get("/:id", id, ctrl.getById);
router.patch("/:id", id, validate(updateActivitySchema), ctrl.update);
router.patch("/:id/complete", id, ctrl.complete);
router.delete("/:id", id, ctrl.remove);

export default router;