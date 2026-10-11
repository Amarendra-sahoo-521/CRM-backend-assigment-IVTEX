import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

import { isProd } from "../config/env";
import { ApiError } from "../utils/ApiError";


interface AppError extends Error {
  statusCode?: number;
  errors?: unknown;
  code?: number;
  keyValue?: Record<string, unknown>;
  path?: string;
  value?: unknown;
  type?: string;
}

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) =>
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = err.statusCode ?? 500;
  let message = err.message || "Internal server error";
  let errors: unknown = err.errors ?? null;
  console.log("err--->",err.name);
  
  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed";
    errors = err.issues.map((i) => ({ field: i.path.map(String).join("."), message: i.message }));
  } else if (err.name === "ValidationError") {
    // mongoose validation
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values((err as any).errors).map((e: any) => ({ field: e.path, message: e.message }));
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${String(err.value)}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue ?? {})[0];
    message = field ? `${field} already exists` : "Duplicate data";
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Invalid or expired token";
  } else if (err.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON body";
  }

  if (statusCode >= 500) {
    console.error(err);
    if (isProd) message = "Internal server error";
  }

  const body: Record<string, unknown> = { success: false, message };
  if (errors) body.errors = errors;
  if (!isProd && statusCode >= 500) body.stack = err.stack;
  res.status(statusCode).json(body);
};