import { z } from "zod";
import {
  LEAD_SOURCE_VALUES, LEAD_SOURCES, LEAD_STATUS_VALUES, LEAD_STATUS,
  PRIORITY_VALUES, PRIORITY,
} from "../constants";
import { objectId, zEnum, phoneSchema, listQuerySchema } from "./common";
import { addressSchema } from "./customer.validator";
import { dealValue, dealProbability, futureDate } from "./deal.validator";

// "Converted" can only be reached through the conversion endpoint
const SETTABLE_STATUSES = LEAD_STATUS_VALUES.filter((s) => s !== LEAD_STATUS.CONVERTED);

export const createLeadSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema.optional(),
  company: z.string().trim().max(150).optional(),
  source: zEnum(LEAD_SOURCE_VALUES).default(LEAD_SOURCES.OTHER),
  priority: zEnum(PRIORITY_VALUES).default(PRIORITY.MEDIUM),
  description: z.string().trim().max(2000).optional(),
  assignedTo: objectId.nullable().optional(),
});

export const updateLeadSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    email: z.string().trim().toLowerCase().email(),
    phone: phoneSchema,
    company: z.string().trim().max(150),
    source: zEnum(LEAD_SOURCE_VALUES),
    priority: zEnum(PRIORITY_VALUES),
    description: z.string().trim().max(2000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const leadStatusSchema = z.object({ status: zEnum(SETTABLE_STATUSES) });

export const assignLeadSchema = z.object({ assignedTo: objectId });

export const listLeadsQuerySchema = listQuerySchema.extend({
  status: zEnum(LEAD_STATUS_VALUES).optional(),
  priority: zEnum(PRIORITY_VALUES).optional(),
  source: zEnum(LEAD_SOURCE_VALUES).optional(),
  assignedTo: z.union([objectId, z.literal("unassigned")]).optional(),
});

export const timelineQuerySchema = listQuerySchema.pick({ page: true, limit: true });

export const convertLeadSchema = z.object({
  dealName: z.string().trim().min(2).max(150).optional(),
  value: dealValue,
  probability: dealProbability,
  expectedCloseDate: futureDate,
  description: z.string().trim().max(2000).optional(),
  address: addressSchema.optional(),
});

export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;