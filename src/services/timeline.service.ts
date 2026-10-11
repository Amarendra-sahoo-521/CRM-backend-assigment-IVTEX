import { ClientSession, Types } from "mongoose";
import { Timeline } from "../models";
import { TimelineAction, EntityType } from "../constants";
import { paginate } from "../utils/queryBuilder";

interface LogParams {
  action: TimelineAction;
  entityType: EntityType;
  entityId: Types.ObjectId | string;
  performedBy: Types.ObjectId | string;
  previousValue?: unknown;
  newValue?: unknown;
}

/** Pass `session` when logging inside a transaction (lead conversion). */
export const logTimeline = async (params: LogParams, session?: ClientSession) => {
  await Timeline.create([params], { session });
};

export const listTimeline = (
  entityType: EntityType,
  entityId: string,
  { page, limit }: { page: number; limit: number }
) =>
  paginate(Timeline, { entityType, entityId }, {
    page,
    limit,
    sort: { createdAt: -1, _id: -1 },
    populate: { path: "performedBy", select: "name role" },
  });