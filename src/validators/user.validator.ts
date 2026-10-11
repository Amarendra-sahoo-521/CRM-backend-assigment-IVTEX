import { z } from "zod";
import { ROLE_VALUES, ROLES } from "../constants";
import { objectId, zEnum, phoneSchema, listQuerySchema, booleanString } from "./common";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(64)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema.optional(),
  password,
  role: zEnum(ROLE_VALUES).default(ROLES.SALES_EXECUTIVE),
  managerId: objectId.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email(),
    phone: phoneSchema,
    password,
    role: zEnum(ROLE_VALUES),
    managerId: objectId.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const userStatusSchema = z.object({ isActive: z.boolean() });

export const listUsersQuerySchema = listQuerySchema.extend({
  role: zEnum(ROLE_VALUES).optional(),
  isActive: booleanString.optional(),
  managerId: objectId.optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;