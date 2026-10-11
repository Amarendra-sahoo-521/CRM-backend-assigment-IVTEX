import { asyncHandler } from "../utils/asyncHandler";
import { sendResponse } from "../utils/ApiResponse";
import * as customerService from "../services/customer.service";
import { ListCustomersQuery } from "../validators/customer.validator";
import { TimelineQuery } from "../validators/lead.validator";

export const create = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.body, req.user!);
  sendResponse(res, { statusCode: 201, message: "Customer created successfully", data: customer });
});

export const list = asyncHandler(async (req, res) => {
  const { data, pagination } = await customerService.listCustomers(res.locals.query as ListCustomersQuery, req.user!);
  sendResponse(res, { message: "Customers fetched successfully", data, pagination });
});

export const getById = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id as string, req.user!);
  sendResponse(res, { message: "Customer fetched successfully", data: customer });
});

export const update = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id as string, req.body, req.user!);
  sendResponse(res, { message: "Customer updated successfully", data: customer });
});

export const remove = asyncHandler(async (req, res) => {
  await customerService.deleteCustomer(req.params.id as string, req.user!);
  sendResponse(res, { message: "Customer deleted successfully" });
});

export const timeline = asyncHandler(async (req, res) => {
  const { data, pagination } = await customerService.getCustomerTimeline(
    req.params.id as string,
    res.locals.query as TimelineQuery,
    req.user!
  );
  sendResponse(res, { message: "Customer timeline fetched successfully", data, pagination });
});