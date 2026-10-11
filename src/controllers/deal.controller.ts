import { asyncHandler } from "../utils/asyncHandler";
import { sendResponse } from "../utils/ApiResponse";
import * as dealService from "../services/deal.service";
import { ListDealsQuery } from "../validators/deal.validator";
import { TimelineQuery } from "../validators/lead.validator";

export const create = asyncHandler(async (req, res) => {
  const deal = await dealService.createDeal(req.body, req.user!);
  sendResponse(res, { statusCode: 201, message: "Deal created successfully", data: deal });
});

export const list = asyncHandler(async (req, res) => {
  const { data, pagination } = await dealService.listDeals(res.locals.query as ListDealsQuery, req.user!);
  sendResponse(res, { message: "Deals fetched successfully", data, pagination });
});

export const getById = asyncHandler(async (req, res) => {
  const deal = await dealService.getDealById(req.params.id as string, req.user!);
  sendResponse(res, { message: "Deal fetched successfully", data: deal });
});

export const update = asyncHandler(async (req, res) => {
  const deal = await dealService.updateDeal(req.params.id as string, req.body, req.user!);
  sendResponse(res, { message: "Deal updated successfully", data: deal });
});

export const updateStage = asyncHandler(async (req, res) => {
  const deal = await dealService.updateDealStage(req.params.id as string, req.body, req.user!);
  sendResponse(res, { message: "Deal stage updated successfully", data: deal });
});

export const assign = asyncHandler(async (req, res) => {
  const deal = await dealService.assignDeal(req.params.id as string, req.body.assignedTo, req.user!);
  sendResponse(res, { message: "Deal assigned successfully", data: deal });
});

export const remove = asyncHandler(async (req, res) => {
  await dealService.deleteDeal(req.params.id as string, req.user!);
  sendResponse(res, { message: "Deal deleted successfully" });
});

export const timeline = asyncHandler(async (req, res) => {
  const { data, pagination } = await dealService.getDealTimeline(
    req.params.id as string,
    res.locals.query as TimelineQuery,
    req.user!
  );
  sendResponse(res, { message: "Deal timeline fetched successfully", data, pagination });
});