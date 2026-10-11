import { z } from "zod";
import { CUSTOMER_STATUS_VALUES, CUSTOMER_STATUS } from "../constants";
import { objectId, zEnum, phoneSchema, listQuerySchema } from "./common";

export const addressSchema = z.object({
  street: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  zipCode: z.string().trim().max(20).optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema.optional(),
  company: z.string().trim().max(150).optional(),
  address: addressSchema.optional(),
  status: zEnum(CUSTOMER_STATUS_VALUES).default(CUSTOMER_STATUS.ACTIVE),
  assignedTo: objectId.optional(),
});

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    email: z.string().trim().toLowerCase().email(),
    phone: phoneSchema,
    company: z.string().trim().max(150),
    address: addressSchema,
    status: zEnum(CUSTOMER_STATUS_VALUES),
    assignedTo: objectId,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const listCustomersQuerySchema = listQuerySchema.extend({
  status: zEnum(CUSTOMER_STATUS_VALUES).optional(),
  assignedTo: objectId.optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;