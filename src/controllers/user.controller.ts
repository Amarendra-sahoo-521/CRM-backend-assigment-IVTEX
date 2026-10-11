import { asyncHandler } from "../utils/asyncHandler";
import { sendResponse } from "../utils/ApiResponse";
import * as userService from "../services/user.service";
import { ListUsersQuery } from "../validators/user.validator";

export const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  sendResponse(res, { statusCode: 201, message: "User created successfully", data: user });
});

export const list = asyncHandler(async (_req, res) => {  
  const { data, pagination } = await userService.listUsers(res.locals.query as ListUsersQuery);
  sendResponse(res, { message: "Users fetched successfully", data, pagination });
});

export const getById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id as string);
  sendResponse(res, { message: "User fetched successfully", data: user });
});

export const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id as string, req.body, req.user!);
  sendResponse(res, { message: "User updated successfully", data: user });
});

export const setStatus = asyncHandler(async (req, res) => {
  const user = await userService.setUserStatus(req.params.id as string, req.body.isActive, req.user!);
  sendResponse(res, {
    message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
    data: user,
  });
});

export const remove = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id as string, req.user!);
  sendResponse(res, { message: "User deleted successfully" });
});