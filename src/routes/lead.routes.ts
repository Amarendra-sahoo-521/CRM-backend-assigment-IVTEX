import { Router } from "express";
import * as ctrl from "../controllers/lead.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ROLES } from "../constants";
import { idParamSchema } from "../validators/common";
import {
  createLeadSchema, updateLeadSchema, leadStatusSchema, assignLeadSchema,
  listLeadsQuerySchema, timelineQuerySchema,
  convertLeadSchema,
} from "../validators/lead.validator";

const router = Router();
const id = validate(idParamSchema, "params");

router.use(authenticate);


router.get("/assignable-users", authorize(ROLES.ADMIN, ROLES.SALES_MANAGER), ctrl.assignableUsers);

router.get("/", validate(listLeadsQuerySchema, "query"), ctrl.list);
router.post("/", validate(createLeadSchema), ctrl.create);
router.get("/:id", id, ctrl.getById); 
router.patch("/:id", id, validate(updateLeadSchema), ctrl.update); 
router.patch("/:id/status", id, validate(leadStatusSchema), ctrl.updateStatus); 
router.patch("/:id/assign", authorize(ROLES.ADMIN, ROLES.SALES_MANAGER), id, validate(assignLeadSchema), ctrl.assign);
router.get("/:id/timeline", id, validate(timelineQuerySchema, "query"), ctrl.timeline); 
router.delete("/:id", authorize(ROLES.ADMIN), id, ctrl.remove);
router.post("/:id/convert", id, validate(convertLeadSchema), ctrl.convert); 

export default router;