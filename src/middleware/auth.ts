import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";
import { Role } from "../constants";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";
import { ACCESS_COOKIE } from "../utils/cookies";
import { asyncHandler } from "../utils/asyncHandler";

const extractToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[ACCESS_COOKIE];
};

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized("Authentication required");

  const { sub } = verifyAccessToken(token); // JWT errors -> 401 via errorHandler
  const user = await User.findById(sub);     // fresh read: role/active changes apply instantly
  if (!user) throw ApiError.unauthorized("User no longer exists");
  if (!user.isActive) throw ApiError.forbidden("Your account has been deactivated");

  req.user = user;
  next();
});

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized("Authentication required"));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };