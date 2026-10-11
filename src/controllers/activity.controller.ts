import { asyncHandler } from "../utils/asyncHandler";
import { sendResponse } from "../utils/ApiResponse";
import * as activityService from "../services/activity.service";
import { ListActivitiesQuery } from "../validators/activity.validator";

export const create = asyncHandler(async (req, res) => {
  const activity = await activityService.createActivity(req.body, req.user!);
  sendResponse(res, { statusCode: 201, message: "Activity created successfully", data: activity });
});

export const list = asyncHandler(async (req, res) => {
  const { data, pagination } = await activityService.listActivities(res.locals.query as ListActivitiesQuery, req.user!);
  sendResponse(res, { message: "Activities fetched successfully", data, pagination });
});

export const getById = asyncHandler(async (req, res) => {
  const activity = await activityService.getActivityById(req.params.id as string, req.user!);
  sendResponse(res, { message: "Activity fetched successfully", data: activity });
});

export const update = asyncHandler(async (req, res) => {
  const activity = await activityService.updateActivity(req.params.id as string, req.body, req.user!);
  sendResponse(res, { message: "Activity updated successfully", data: activity });
});

export const complete = asyncHandler(async (req, res) => {
  const activity = await activityService.completeActivity(req.params.id as string, req.user!);
  sendResponse(res, { message: "Activity marked as completed", data: activity });
});

export const remove = asyncHandler(async (req, res) => {
  await activityService.deleteActivity(req.params.id as string, req.user!);
  sendResponse(res, { message: "Activity deleted successfully" });
});