import { asyncHandler } from "../utils/asyncHandler";
import { sendResponse } from "../utils/ApiResponse";
import * as analytics from "../services/analytics.service";
import { AnalyticsQuery, TeamPerformanceQuery } from "../validators/analytics.validator";

export const dashboard = asyncHandler(async (req, res) => {
  const data = await analytics.getDashboard(res.locals.query as AnalyticsQuery, req.user!);
  sendResponse(res, { message: "Dashboard statistics fetched successfully", data });
});

export const pipeline = asyncHandler(async (req, res) => {
  const data = await analytics.getPipeline(res.locals.query as AnalyticsQuery, req.user!);
  sendResponse(res, { message: "Sales pipeline fetched successfully", data });
});

export const teamPerformance = asyncHandler(async (req, res) => {
  const data = await analytics.getTeamPerformance(res.locals.query as TeamPerformanceQuery, req.user!);
  sendResponse(res, { message: "Team performance fetched successfully", data });
});