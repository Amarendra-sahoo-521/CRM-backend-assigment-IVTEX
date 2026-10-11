import { Types } from "mongoose";
import { Activity, Lead, Customer, Deal, User } from "../models";
import {
  ROLES, ACTIVITY_TYPES, ACTIVITY_STATUS, ENTITY_TYPES, TIMELINE_ACTIONS, EntityType, TimelineAction,
} from "../constants";
import { ApiError } from "../utils/ApiError";
import { buildAccessScope, getTeamUserIds, Actor } from "../utils/accessScope";
import {
  paginate, buildSort, searchFilter, dateRangeFilter, andFilters, Filter,
} from "../utils/queryBuilder";
import { assertAssignable } from "./assignment.service";
import { logTimeline } from "./timeline.service";
import {
  CreateActivityInput, UpdateActivityInput, ListActivitiesQuery,
} from "../validators/activity.validator";

const SORTABLE = ["title", "type", "status", "dueDate", "createdAt", "updatedAt"];
const POPULATE = [
  { path: "assignedTo", select: "name email role" },
  { path: "createdBy", select: "name" },
  { path: "entityId", select: "name" }, 
];

const findScopedActivity = async (id: string, actor: Actor) => {
  const activity = await Activity.findOne(andFilters({ _id: id }, await buildAccessScope(actor)));
  if (!activity) throw ApiError.notFound("Activity not found");
  return activity;
};

/** Self always; others only via the normal assignment rules (Admin -> any exec, Manager -> own team). */
const resolveAssignee = async (actor: Actor, assignedTo?: string): Promise<Types.ObjectId> => {
  if (!assignedTo || assignedTo === actor.id) return actor._id;
  if (actor.role === ROLES.SALES_EXECUTIVE) {
    throw ApiError.forbidden("Sales Executives cannot assign activities to others");
  }
  return (await assertAssignable(actor, assignedTo))._id;
};

/** The actor may only attach activities to records they can already see. */
const assertEntityAccessible = async (type: EntityType, id: string, actor: Actor) => {
  let found: unknown = null;
  switch (type) {
    case ENTITY_TYPES.LEAD:
      found = await Lead.exists(andFilters({ _id: id }, await buildAccessScope(actor, { creatorField: "createdBy" })));
      break;
    case ENTITY_TYPES.CUSTOMER:
      found = await Customer.exists(andFilters({ _id: id }, await buildAccessScope(actor)));
      break;
    case ENTITY_TYPES.DEAL:
      found = await Deal.exists(andFilters({ _id: id }, await buildAccessScope(actor)));
      break;
    case ENTITY_TYPES.USER:
      if (actor.role === ROLES.ADMIN) found = await User.exists({ _id: id });
      else if (actor.role === ROLES.SALES_MANAGER) {
        found = (await getTeamUserIds(actor)).some((u) => u.toString() === id);
      } else found = actor.id === id;
      break;
  }
  if (!found) throw ApiError.notFound(`${type} not found`);
};

/** Logged on the related record's timeline; unlinked activities log against themselves. */
const logActivityEvent = (
  action: TimelineAction,
  activity: InstanceType<typeof Activity>,
  actor: Actor,
  extra: Record<string, unknown> = {}
) =>
  logTimeline({
    action,
    entityType: activity.entityType ?? ENTITY_TYPES.ACTIVITY,
    entityId: activity.entityId ?? activity._id,
    performedBy: actor._id,
    newValue: {
      activityId: activity.id,
      type: activity.type,
      title: activity.title,
      dueDate: activity.dueDate,
      ...extra,
    },
  });

export const createActivity = async (input: CreateActivityInput, actor: Actor) => {
  const assignedTo = await resolveAssignee(actor, input.assignedTo);
  if (input.entityType && input.entityId) {
    await assertEntityAccessible(input.entityType, input.entityId, actor);
  }

  const isNote = input.type === ACTIVITY_TYPES.NOTE;
  const now = new Date();

  const activity = await Activity.create({
    type: input.type,
    title: input.title,
    description: input.description,
    assignedTo,
    dueDate: isNote ? now : input.dueDate,
    status: isNote ? ACTIVITY_STATUS.COMPLETED : ACTIVITY_STATUS.PENDING, 
    completedAt: isNote ? now : null,
    entityType: input.entityType,
    entityId: input.entityId,
    createdBy: actor._id,
  });

  await logActivityEvent(isNote ? TIMELINE_ACTIONS.NOTE_ADDED : TIMELINE_ACTIONS.FOLLOWUP_CREATED, activity, actor);
  return activity.populate(POPULATE);
};

export const listActivities = async (q: ListActivitiesQuery, actor: Actor) => {
  const now = new Date();
  // "Overdue" is derived: still Pending and past its due date
  const statusFilter: Filter =
    q.status === ACTIVITY_STATUS.COMPLETED ? { status: ACTIVITY_STATUS.COMPLETED }
    : q.status === ACTIVITY_STATUS.PENDING ? { status: ACTIVITY_STATUS.PENDING, dueDate: { $gte: now } }
    : q.status === ACTIVITY_STATUS.OVERDUE ? { status: ACTIVITY_STATUS.PENDING, dueDate: { $lt: now } }
    : {};

  const filter = andFilters(
    await buildAccessScope(actor), 
    searchFilter(q.search, ["title", "description"]),
    dateRangeFilter("createdAt", q.dateFrom, q.dateTo),
    dateRangeFilter("dueDate", q.dueFrom, q.dueTo),
    statusFilter,
    q.type ? { type: q.type } : {},
    q.assignedTo ? { assignedTo: q.assignedTo } : {},
    q.entityType ? { entityType: q.entityType } : {},
    q.entityId ? { entityId: q.entityId } : {}
  );

  return paginate(Activity, filter, {
    page: q.page,
    limit: q.limit,
    sort: buildSort(q.sortBy, q.order, SORTABLE),
    populate: POPULATE,
  });
};

export const getActivityById = async (id: string, actor: Actor) => {
  const activity = await findScopedActivity(id, actor);
  return activity.populate(POPULATE);
};

export const updateActivity = async (id: string, input: UpdateActivityInput, actor: Actor) => {
  const activity = await findScopedActivity(id, actor);
  const isNote = activity.type === ACTIVITY_TYPES.NOTE;

  if (activity.status === ACTIVITY_STATUS.COMPLETED && !isNote) {
    throw ApiError.conflict("Completed activities cannot be modified");
  }
  if (isNote && input.dueDate) throw ApiError.badRequest("Notes do not have a due date");

  const { assignedTo, ...rest } = input;
  if (assignedTo !== undefined) activity.assignedTo = await resolveAssignee(actor, assignedTo);
  activity.set(rest);
  await activity.save();
  return activity.populate(POPULATE);
};

export const completeActivity = async (id: string, actor: Actor) => {
  const activity = await findScopedActivity(id, actor);
  if (activity.status === ACTIVITY_STATUS.COMPLETED) throw ApiError.conflict("Activity is already completed");

  const completedAt = new Date();
  const wasOverdue = activity.dueDate.getTime() < completedAt.getTime();

  activity.status = ACTIVITY_STATUS.COMPLETED;
  activity.completedAt = completedAt;
  await activity.save();

  await logActivityEvent(TIMELINE_ACTIONS.FOLLOWUP_COMPLETED, activity, actor, { wasOverdue });
  return activity.populate(POPULATE);
};

export const deleteActivity = async (id: string, actor: Actor) => {
  const activity = await findScopedActivity(id, actor);
  // Admin: any. Manager: within team scope. Executive: only ones they created themselves.
  if (actor.role === ROLES.SALES_EXECUTIVE && activity.createdBy.toString() !== actor.id) {
    throw ApiError.forbidden("You can only delete activities you created");
  }
  await activity.deleteOne();
};