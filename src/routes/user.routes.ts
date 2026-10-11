import { Router } from "express";
import * as ctrl from "../controllers/user.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ROLES } from "../constants";
import { idParamSchema } from "../validators/common";
import {
  createUserSchema, updateUserSchema, userStatusSchema, listUsersQuerySchema,
} from "../validators/user.validator";

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN)); 

router.post("/", validate(createUserSchema), ctrl.create);
router.get("/", validate(listUsersQuerySchema, "query"), ctrl.list);
router.get("/:id", validate(idParamSchema, "params"), ctrl.getById);
router.patch("/:id", validate(idParamSchema, "params"), validate(updateUserSchema), ctrl.update);
router.patch("/:id/status", validate(idParamSchema, "params"), validate(userStatusSchema), ctrl.setStatus);
router.delete("/:id", validate(idParamSchema, "params"), ctrl.remove);

export default router;