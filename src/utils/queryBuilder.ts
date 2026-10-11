import { Model, HydratedDocument } from "mongoose";
import type { Pagination } from "./ApiResponse";

export type Filter = Record<string, unknown>;

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive partial match across several fields. */
export const searchFilter = (search: string | undefined, fields: string[]): Filter => {
  if (!search) return {};
  const rx = new RegExp(escapeRegex(search), "i");
  return { $or: fields.map((f) => ({ [f]: rx })) };
};

/** dateTo given as YYYY-MM-DD includes the whole day. */
export const dateRangeFilter = (field: string, from?: string, to?: string): Filter => {
  if (!from && !to) return {};
  const range: Record<string, Date> = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999Z`) : new Date(to);
  return { [field]: range };
};

/** Min/max range on a numeric field (used for deal amounts later). */
export const numberRangeFilter = (field: string, min?: number, max?: number): Filter => {
  if (min === undefined && max === undefined) return {};
  const range: Record<string, number> = {};
  if (min !== undefined) range.$gte = min;
  if (max !== undefined) range.$lte = max;
  return { [field]: range };
};

/** Drops empty filters and combines the rest with $and (so $or filters never clash). */
export const andFilters = (...parts: Filter[]): Filter => {
  const nonEmpty = parts.filter((p) => Object.keys(p).length > 0);
  
  
  return nonEmpty.length ? { $and: nonEmpty } : {};
};

/** Whitelisted sort + _id tiebreaker so pages are stable. */
export const buildSort = (
  sortBy: string | undefined,
  order: "asc" | "desc",
  allowed: string[],
  fallback = "createdAt"
): Record<string, 1 | -1> => {
  const field = sortBy && allowed.includes(sortBy) ? sortBy : fallback;
  const dir = order === "asc" ? 1 : -1;
  return { [field]: dir, _id: dir };
};

export interface PaginateOptions {
  page: number;
  limit: number;
  sort: Record<string, 1 | -1>;
  select?: string;
  populate?: unknown;
}

export const paginate = async <T>(
  model: Model<T>,
  filter: Filter,
  { page, limit, sort, select, populate }: PaginateOptions
): Promise<{ data: HydratedDocument<T>[]; pagination: Pagination }> => {
  
  let query: any = model.find(filter as any).sort(sort).skip((page - 1) * limit).limit(limit);
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);

  const [data, total] = await Promise.all([query.exec(), model.countDocuments(filter as any)]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};