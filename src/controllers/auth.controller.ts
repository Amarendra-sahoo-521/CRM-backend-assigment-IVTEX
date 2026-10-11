import { asyncHandler } from "../utils/asyncHandler";
import { sendResponse } from "../utils/ApiResponse";
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from "../utils/cookies";
import * as authService from "../services/auth.service";

export const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  sendResponse(res, { statusCode: 201, message: "User registered successfully", data: user });
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
  setAuthCookies(res, accessToken, refreshToken);
  sendResponse(res, { message: "Login successful", data: { user, accessToken } });
});

export const refresh = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.refresh(req.cookies?.[REFRESH_COOKIE]);
  setAuthCookies(res, accessToken, refreshToken);
  sendResponse(res, { message: "Token refreshed", data: { user, accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  sendResponse(res, { message: "Logged out successfully" });
});

export const me = asyncHandler(async (req, res) => {
  // console.log("req",req);
  sendResponse(res, { message: "Profile fetched successfully", data: req.user });
});