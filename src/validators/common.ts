import { z } from "zod";

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");


// z.enum needs a non-empty tuple; this adapts our readonly arrays
export const zEnum = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, "Invalid phone number");

export const idParamSchema = z.object({ id: objectId });


export const dateString = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

// extend this for every list endpoint
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.string().trim().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().trim().max(100).optional(),
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
});

export const booleanString = z.enum(["true", "false"]).transform((v) => v === "true");