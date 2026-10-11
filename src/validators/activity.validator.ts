import { z } from "zod";
import {
  ACTIVITY_TYPE_VALUES, ACTIVITY_STATUS_VALUES, ACTIVITY_ENTITY_VALUES, ACTIVITY_TYPES,
} from "../constants";
import { objectId, zEnum, listQuerySchema, dateString } from "./common";

export const createActivitySchema = z
  .object({
    type: zEnum(ACTIVITY_TYPE_VALUES),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    dueDate: z.coerce.date().optional(),
    assignedTo: objectId.optional(),
    entityType: zEnum(ACTIVITY_ENTITY_VALUES).optional(),
    entityId: objectId.optional(),
  })
  .refine((v) => !!v.entityType === !!v.entityId, {
    message: "entityType and entityId must be provided together",
    path: ["entityId"],
  })
  .refine((v) => v.type === ACTIVITY_TYPES.NOTE || !!v.dueDate, {
    message: "dueDate is required",
    path: ["dueDate"],
  });

export const updateActivitySchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000),
    dueDate: z.coerce.date(),
    assignedTo: objectId,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const listActivitiesQuerySchema = listQuerySchema.extend({
  type: zEnum(ACTIVITY_TYPE_VALUES).optional(),
  status: zEnum(ACTIVITY_STATUS_VALUES).optional(),
  assignedTo: objectId.optional(),
  entityType: zEnum(ACTIVITY_ENTITY_VALUES).optional(),
  entityId: objectId.optional(),
  dueFrom: dateString.optional(),
  dueTo: dateString.optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;