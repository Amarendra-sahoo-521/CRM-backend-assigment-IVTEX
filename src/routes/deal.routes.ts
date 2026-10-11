import { Router } from "express";
import * as ctrl from "../controllers/deal.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ROLES } from "../constants";
import { idParamSchema } from "../validators/common";
import {
  createDealSchema, updateDealSchema, dealStageSchema, assignDealSchema, listDealsQuerySchema,
} from "../validators/deal.validator";
import { timelineQuerySchema } from "../validators/lead.validator";

const router = Router();
const id = validate(idParamSchema, "params");

router.use(authenticate);

router.post("/", validate(createDealSchema), ctrl.create);
router.get("/", validate(listDealsQuerySchema, "query"), ctrl.list);
router.get("/:id", id, ctrl.getById);
router.patch("/:id", id, validate(updateDealSchema), ctrl.update); 
router.patch("/:id/stage", id, validate(dealStageSchema), ctrl.updateStage);
router.patch("/:id/assign", authorize(ROLES.ADMIN, ROLES.SALES_MANAGER), id, validate(assignDealSchema), ctrl.assign); 
router.get("/:id/timeline", id, validate(timelineQuerySchema, "query"), ctrl.timeline);
router.delete("/:id", authorize(ROLES.ADMIN), id, ctrl.remove); 

export default router;