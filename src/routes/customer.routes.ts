import { Router } from "express";
import * as ctrl from "../controllers/customer.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { ROLES } from "../constants";
import { idParamSchema } from "../validators/common";
import {
  createCustomerSchema, updateCustomerSchema, listCustomersQuerySchema,
} from "../validators/customer.validator";
import { timelineQuerySchema } from "../validators/lead.validator";

const router = Router();
const id = validate(idParamSchema, "params");

router.use(authenticate);

router.post("/", validate(createCustomerSchema), ctrl.create);
router.get("/", validate(listCustomersQuerySchema, "query"), ctrl.list);
router.get("/:id", id, ctrl.getById);
router.patch("/:id", id, validate(updateCustomerSchema), ctrl.update); 
router.get("/:id/timeline", id, validate(timelineQuerySchema, "query"), ctrl.timeline); //01
router.delete("/:id", authorize(ROLES.ADMIN), id, ctrl.remove); //01

export default router;