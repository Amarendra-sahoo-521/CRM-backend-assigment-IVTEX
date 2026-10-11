import { asyncHandler } from "../utils/asyncHandler";
import { sendResponse } from "../utils/ApiResponse";
import * as leadService from "../services/lead.service";
import { getAssignableExecutives } from "../services/assignment.service";
import { ListLeadsQuery, TimelineQuery } from "../validators/lead.validator";
import { convertLead } from "../services/conversion.service";

export const create = asyncHandler(async (req, res) => {
  const lead = await leadService.createLead(req.body, req.user!);
  sendResponse(res, { statusCode: 201, message: "Lead created successfully", data: lead });
});

export const list = asyncHandler(async (req, res) => {
  const { data, pagination } = await leadService.listLeads(res.locals.query as ListLeadsQuery, req.user!);
  sendResponse(res, { message: "Leads fetched successfully", data, pagination });
});

export const getById = asyncHandler(async (req, res) => {
  const lead = await leadService.getLeadById(req.params.id as string, req.user!);
  sendResponse(res, { message: "Lead fetched successfully", data: lead });
});

export const update = asyncHandler(async (req, res) => {
  const lead = await leadService.updateLead(req.params.id as string, req.body, req.user!);
  sendResponse(res, { message: "Lead updated successfully", data: lead });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const lead = await leadService.updateLeadStatus(req.params.id as string, req.body.status, req.user!);
  sendResponse(res, { message: "Lead status updated successfully", data: lead });
});

export const assign = asyncHandler(async (req, res) => {
  const lead = await leadService.assignLead(req.params.id as string, req.body.assignedTo, req.user!);
  sendResponse(res, { message: "Lead assigned successfully", data: lead });
});

export const remove = asyncHandler(async (req, res) => {
  await leadService.deleteLead(req.params.id as string, req.user!);
  sendResponse(res, { message: "Lead deleted successfully" });
});

export const timeline = asyncHandler(async (req, res) => {
  const { data, pagination } = await leadService.getLeadTimeline(
    req.params.id as string,
    res.locals.query as TimelineQuery,
    req.user!
  );
  sendResponse(res, { message: "Lead timeline fetched successfully", data, pagination });
});

export const assignableUsers = asyncHandler(async (req, res) => {
  const users = await getAssignableExecutives(req.user!);
  sendResponse(res, { message: "Assignable users fetched successfully", data: users });
});

export const convert = asyncHandler(async (req, res) => {
  const result = await convertLead(req.params.id as string, req.body, req.user!);
  sendResponse(res, { statusCode: 201, message: "Lead converted successfully", data: result });
});