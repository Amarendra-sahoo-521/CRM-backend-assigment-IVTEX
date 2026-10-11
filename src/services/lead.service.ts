import { Types } from "mongoose";
import { Lead, Activity, Timeline } from "../models";
import { ROLES, LEAD_STATUS, LeadStatus, ENTITY_TYPES, TIMELINE_ACTIONS } from "../constants";
import { ApiError } from "../utils/ApiError";
import { buildAccessScope, Actor } from "../utils/accessScope";
import {
  paginate, buildSort, searchFilter, dateRangeFilter, andFilters, Filter,
} from "../utils/queryBuilder";
import { assertAssignable } from "./assignment.service";
import { logTimeline, listTimeline } from "./timeline.service";
import {
  CreateLeadInput, UpdateLeadInput, ListLeadsQuery, TimelineQuery,
} from "../validators/lead.validator";

const SORTABLE = ["name", "email", "company", "status", "priority", "source", "createdAt", "updatedAt"];
const POPULATE = [
  { path: "assignedTo", select: "name email role" },
  { path: "createdBy", select: "name email" },
];

const leadScope = (actor: Actor) => buildAccessScope(actor, { creatorField: "createdBy" });

/** Out-of-scope leads look exactly like missing ones (404), so IDs can't be probed. */
const findScopedLead = async (id: string, actor: Actor) => {
  const lead = await Lead.findOne(andFilters({ _id: id }, await leadScope(actor)));
  if (!lead) throw ApiError.notFound("Lead not found");
  return lead;
};

const assertNotConverted = (status: LeadStatus) => {
  if (status === LEAD_STATUS.CONVERTED) throw ApiError.conflict("Converted leads cannot be modified");
};

export const createLead = async (input: CreateLeadInput, actor: Actor) => {
  let assignedTo: Types.ObjectId | null = null;

  if (actor.role === ROLES.SALES_EXECUTIVE) {
    if (input.assignedTo && input.assignedTo !== actor.id) {
      throw ApiError.forbidden("Sales Executives cannot assign leads to others");
    }
    assignedTo = actor._id; 
  } else if (input.assignedTo) {
    assignedTo = (await assertAssignable(actor, input.assignedTo))._id;
  }

  const lead = await Lead.create({
    ...input,
    assignedTo,
    status: LEAD_STATUS.NEW,
    createdBy: actor._id,
  });

  await logTimeline({
    action: TIMELINE_ACTIONS.LEAD_CREATED,
    entityType: ENTITY_TYPES.LEAD,
    entityId: lead._id,
    performedBy: actor._id,
    newValue: { name: lead.name, status: lead.status, priority: lead.priority },
  });

  if (assignedTo && actor.role !== ROLES.SALES_EXECUTIVE) {
    await logTimeline({
      action: TIMELINE_ACTIONS.LEAD_ASSIGNED,
      entityType: ENTITY_TYPES.LEAD,
      entityId: lead._id,
      performedBy: actor._id,
      newValue: { assignedTo: assignedTo.toString() },
    });
  }

  return lead.populate(POPULATE);
};

export const listLeads = async (q: ListLeadsQuery, actor: Actor) => {
  const assignedFilter: Filter =
    q.assignedTo === "unassigned" ? { assignedTo: null } : q.assignedTo ? { assignedTo: q.assignedTo } : {};
    
    const filter = andFilters(
      await leadScope(actor), // role scope ALWAYS applied
      searchFilter(q.search, ["name", "email", "company", "phone"]),
      dateRangeFilter("createdAt", q.dateFrom, q.dateTo),
      q.status ? { status: q.status } : {},
      q.priority ? { priority: q.priority } : {},
      q.source ? { source: q.source } : {},
      assignedFilter
    );

  return paginate(Lead, filter, {
    page: q.page,
    limit: q.limit,
    sort: buildSort(q.sortBy, q.order, SORTABLE),
    populate: POPULATE,
  });
};

export const getLeadById = async (id: string, actor: Actor) => {
  const lead = await findScopedLead(id, actor);
  return lead.populate(POPULATE);
};

export const updateLead = async (id: string, input: UpdateLeadInput, actor: Actor) => {
  const lead = await findScopedLead(id, actor);
  assertNotConverted(lead.status);

  const previousPriority = lead.priority;
  lead.set(input); 
  await lead.save();

  if (input.priority && input.priority !== previousPriority) {
    await logTimeline({
      action: TIMELINE_ACTIONS.LEAD_PRIORITY_CHANGED,
      entityType: ENTITY_TYPES.LEAD,
      entityId: lead._id,
      performedBy: actor._id,
      previousValue: previousPriority,
      newValue: input.priority,
    });
  }
  return lead.populate(POPULATE);
};

export const updateLeadStatus = async (id: string, status: LeadStatus, actor: Actor) => {
  const lead = await findScopedLead(id, actor);
  assertNotConverted(lead.status);
  if (lead.status === status) throw ApiError.badRequest(`Lead is already ${status}`);

  const previous = lead.status;
  lead.status = status;
  await lead.save();

  await logTimeline({
    action: TIMELINE_ACTIONS.LEAD_STATUS_CHANGED,
    entityType: ENTITY_TYPES.LEAD,
    entityId: lead._id,
    performedBy: actor._id,
    previousValue: previous,
    newValue: status,
  });
  return lead.populate(POPULATE);
};

export const assignLead = async (id: string, assigneeId: string, actor: Actor) => {
  const lead = await findScopedLead(id, actor); // manager can only touch in-scope leads
  assertNotConverted(lead.status);
  const assignee = await assertAssignable(actor, assigneeId);
  if (lead.assignedTo?.toString() === assignee.id) {
    throw ApiError.badRequest("Lead is already assigned to this user");
  }

  const previousId = lead.assignedTo;
  const previous = previousId ? await Lead.db.model("User").findById(previousId).select("name") : null;

  lead.assignedTo = assignee._id;
  await lead.save();

  await logTimeline({
    action: previousId ? TIMELINE_ACTIONS.LEAD_REASSIGNED : TIMELINE_ACTIONS.LEAD_ASSIGNED,
    entityType: ENTITY_TYPES.LEAD,
    entityId: lead._id,
    performedBy: actor._id,
    previousValue: previousId ? { id: previousId.toString(), name: (previous as { name?: string } | null)?.name } : null,
    newValue: { id: assignee.id, name: assignee.name },
  });
  return lead.populate(POPULATE);
};

export const deleteLead = async (id: string, actor: Actor) => {
  const lead = await findScopedLead(id, actor); // route is Admin-only; scope kept for safety
  if (lead.status === LEAD_STATUS.CONVERTED || lead.convertedCustomerId) {
    throw ApiError.conflict("Converted leads cannot be deleted");
  }
  await Promise.all([
    Activity.deleteMany({ entityType: ENTITY_TYPES.LEAD, entityId: lead._id }),
    Timeline.deleteMany({ entityType: ENTITY_TYPES.LEAD, entityId: lead._id }),
  ]);
  await lead.deleteOne();
};

export const getLeadTimeline = async (id: string, q: TimelineQuery, actor: Actor) => {
  await findScopedLead(id, actor); 
  return listTimeline(ENTITY_TYPES.LEAD, id, q);
};