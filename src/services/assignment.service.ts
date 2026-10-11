import { User } from "../models";
import { ROLES } from "../constants";
import { ApiError } from "../utils/ApiError";
import type { Actor } from "../utils/accessScope";
import type { Filter } from "../utils/queryBuilder";

/** Active sales executives the actor is allowed to assign work to. */
export const getAssignableExecutives = async (actor: Actor) => {
  
  const filter: Filter = { role: ROLES.SALES_EXECUTIVE, isActive: true };
  if (actor.role === ROLES.SALES_MANAGER) filter.managerId = actor._id;
  else if (actor.role !== ROLES.ADMIN) throw ApiError.forbidden("You cannot assign work to others");

  return User.find(filter).select("name email phone managerId").sort({ name: 1 });
};

export const assertAssignable = async (actor: Actor, assigneeId: string) => {
  if (actor.role === ROLES.SALES_EXECUTIVE) {
    throw ApiError.forbidden("Sales Executives cannot assign work to others");
  }

  const assignee = await User.findById(assigneeId);
  if (!assignee || !assignee.isActive || assignee.role !== ROLES.SALES_EXECUTIVE) {
    throw ApiError.badRequest("Assignee must be an active Sales Executive");
  }
  if (actor.role === ROLES.SALES_MANAGER && assignee.managerId?.toString() !== actor.id) {
    throw ApiError.forbidden("You can only assign to members of your own team");
  }
  return assignee;
};