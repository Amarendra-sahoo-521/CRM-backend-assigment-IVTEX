import { Response } from "express";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ResponseOptions<T> {
  statusCode?: number;
  message?: string;
  data?: T | null;
  pagination?: Pagination;
}

export const sendResponse = <T>(
  res: Response,
  { statusCode = 200, message = "Success", data = null, pagination }: ResponseOptions<T>
): Response => {
  const body: Record<string, unknown> = { success: true, message, data };
  if (pagination) body.pagination = pagination;
  return res.status(statusCode).json(body);
};