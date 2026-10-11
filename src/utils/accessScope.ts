import { HydratedDocument, Types } from "mongoose";
import { User, IUser } from "../models";
import { ROLES } from "../constants";
import type { Filter } from "./queryBuilder";

export type Actor = HydratedDocument<IUser>;

/** Manager's own id + every executive reporting to them. */
export const getTeamUserIds = async (manager: Actor): Promise<Types.ObjectId[]> => {
  const members = (await User.find({ managerId: manager._id }).distinct("_id")) as Types.ObjectId[];
  return [manager._id, ...members];
};

interface ScopeOptions {
  assigneeField?: string;
  /** when set, managers also see unassigned records created by their team */
  creatorField?: string;
}

/**
 * Admin   -> everything
 * Manager -> records assigned to self or their team
 * Exec    -> only records assigned to them
 * Merge the result into every list AND get-by-id query with andFilters().
 */
export const buildAccessScope = async (
  actor: Actor,
  { assigneeField = "assignedTo", creatorField }: ScopeOptions = {}
): Promise<Filter> => {
  switch (actor.role) {
    case ROLES.ADMIN:
      return {};
    case ROLES.SALES_MANAGER: {
      const ids = await getTeamUserIds(actor);
      const inTeam = { [assigneeField]: { $in: ids } };
         
      return creatorField
        ? { $or: [inTeam, { [assigneeField]: null, [creatorField]: { $in: ids } }] }
        : inTeam;
    }
    default:
      return { [assigneeField]: actor._id };
  }
};