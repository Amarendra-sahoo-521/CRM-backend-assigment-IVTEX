import { z } from "zod";
import { objectId, dateString } from "./common";

export const analyticsQuerySchema = z.object({
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  assignedTo: objectId.optional(),
});

export const teamPerformanceQuerySchema = z.object({
  dateFrom: dateString.optional(),
  dateTo: dateString.optional(),
  managerId: objectId.optional(), // Admin only: limit to one manager's team
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type TeamPerformanceQuery = z.infer<typeof teamPerformanceQuerySchema>;