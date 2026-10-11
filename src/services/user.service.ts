import { HydratedDocument } from "mongoose";
import { User, IUser, Lead, Customer, Deal, Activity, Timeline } from "../models";
import { ROLES, Role } from "../constants";
import { ApiError } from "../utils/ApiError";
import {
  paginate, buildSort, searchFilter, dateRangeFilter, andFilters, Filter,
} from "../utils/queryBuilder";
import { CreateUserInput, UpdateUserInput, ListUsersQuery } from "../validators/user.validator";

const SORTABLE = ["name", "email", "role", "isActive", "createdAt", "updatedAt",];
const MANAGER_POPULATE = { path: "managerId", select: "name email role" };


const resolveManager = async (role: Role, managerId?: string | null) => {
  if (role !== ROLES.SALES_EXECUTIVE) {
    if (managerId) throw ApiError.badRequest("Only Sales Executives can be assigned a manager");
    return null;
  }
  if (!managerId) return null;
  const manager = await User.findOne({ _id: managerId, role: ROLES.SALES_MANAGER, isActive: true });
  if (!manager) throw ApiError.badRequest("Manager not found or not an active Sales Manager");
  return manager._id;
};

export const createUser = async (input: CreateUserInput) => {
  if (await User.exists({ email: input.email })) throw ApiError.conflict("Email already registered");
  const managerId = await resolveManager(input.role, input.managerId);
  return User.create({ ...input, managerId });
};

export const listUsers = async (q: ListUsersQuery) => {
  const filter: Filter = andFilters(
    searchFilter(q.search, ["name", "email"]),
    dateRangeFilter("createdAt", q.dateFrom, q.dateTo),
    q.role ? { role: q.role } : {},
    q.isActive !== undefined ? { isActive: q.isActive } : {},
    q.managerId ? { managerId: q.managerId } : {}
  );

  return paginate(User, filter, {
    page: q.page,
    limit: q.limit,
    sort: buildSort(q.sortBy, q.order, SORTABLE),
    populate: MANAGER_POPULATE,
  });
};

export const getUserById = async (id: string) => {
  const user = await User.findById(id).populate(MANAGER_POPULATE);
  if (!user) throw ApiError.notFound("User not found");
  return user;
};

export const updateUser = async (id: string, input: UpdateUserInput, actor: HydratedDocument<IUser>) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("User not found");

  if (input.email && input.email !== user.email) {
    if (await User.exists({ email: input.email, _id: { $ne: id } })) {
      throw ApiError.conflict("Email already registered");
    }
    user.email = input.email;
  }

  if (input.role && input.role !== user.role) {
    if (actor.id === id) throw ApiError.forbidden("You cannot change your own role");
    if (user.role === ROLES.SALES_MANAGER && (await User.exists({ managerId: id }))) {
      throw ApiError.conflict("This manager still has team members. Reassign them first");
    }
  }

  if (input.role !== undefined || input.managerId !== undefined) {
    const nextRole = input.role ?? user.role;
    const requested =
      input.managerId !== undefined
        ? input.managerId
        : nextRole === ROLES.SALES_EXECUTIVE
          ? (user.managerId?.toString() ?? null)
          : null;
    user.managerId = await resolveManager(nextRole, requested);
  }

  if (input.name !== undefined) user.name = input.name;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.role !== undefined) user.role = input.role;
  if (input.password !== undefined) user.password = input.password; // hashed by pre-save hook

  await user.save();
  return user.populate(MANAGER_POPULATE);
};

export const setUserStatus = async (id: string, isActive: boolean, actor: HydratedDocument<IUser>) => {
  if (actor.id === id && !isActive) throw ApiError.forbidden("You cannot deactivate your own account");
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("User not found");

  user.isActive = isActive;
  if (!isActive) user.refreshToken = null; // kill the session
  await user.save();
  return user;
};

export const deleteUser = async (id: string, actor: HydratedDocument<IUser>) => {
  if (actor.id === id) throw ApiError.forbidden("You cannot delete your own account");
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound("User not found");

  const owns = { $or: [{ assignedTo: id }, { createdBy: id }] };
  const refs = await Promise.all([
    Lead.exists(owns),
    Customer.exists(owns),
    Deal.exists(owns),
    Activity.exists(owns),
    Timeline.exists({ performedBy: id }),
    User.exists({ managerId: id }),
  ]);
  if (refs.some(Boolean)) {
    throw ApiError.conflict("User has related records and cannot be deleted. Deactivate the user instead");
  }

  await user.deleteOne();
};