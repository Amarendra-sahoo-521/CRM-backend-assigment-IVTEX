import { Types } from "mongoose";
import { Deal, Customer, Lead, User, Activity, Timeline } from "../models";
import {
  ROLES, DEAL_STAGES, ACTIVE_DEAL_STAGES, CLOSED_DEAL_STAGES, DealStage,
  CUSTOMER_STATUS, ENTITY_TYPES, TIMELINE_ACTIONS,
} from "../constants";
import { ApiError } from "../utils/ApiError";
import { buildAccessScope, Actor } from "../utils/accessScope";
import {
  paginate, buildSort, searchFilter, dateRangeFilter, numberRangeFilter, andFilters, Filter,
} from "../utils/queryBuilder";
import { assertAssignable } from "./assignment.service";
import { logTimeline, listTimeline } from "./timeline.service";
import {
  CreateDealInput, UpdateDealInput, DealStageInput, ListDealsQuery,
} from "../validators/deal.validator";
import type { TimelineQuery } from "../validators/lead.validator";

const SORTABLE = ["name", "value", "probability", "expectedRevenue", "expectedCloseDate", "stage", "createdAt", "updatedAt"];
const POPULATE = [
  { path: "assignedTo", select: "name email role" },
  { path: "customerId", select: "name email company status" },
  { path: "leadId", select: "name status" },
];

const isClosed = (stage: DealStage) => CLOSED_DEAL_STAGES.includes(stage);

const findScopedDeal = async (id: string, actor: Actor) => {
  const deal = await Deal.findOne(andFilters({ _id: id }, await buildAccessScope(actor)));
  if (!deal) throw ApiError.notFound("Deal not found");
  return deal;
};

const assertOpen = (stage: DealStage) => {
  if (isClosed(stage)) throw ApiError.conflict(`${stage} deals are closed and cannot be modified`);
};

export const createDeal = async (input: CreateDealInput, actor: Actor) => {
  const customer = await Customer.findOne(
    andFilters({ _id: input.customerId }, await buildAccessScope(actor))
  );
  if (!customer) throw ApiError.notFound("Customer not found");
  if (customer.status !== CUSTOMER_STATUS.ACTIVE) {
    throw ApiError.badRequest("Cannot create a deal for an inactive customer");
  }

  let assignedTo: Types.ObjectId;
  if (actor.role === ROLES.SALES_EXECUTIVE) {
    if (input.assignedTo && input.assignedTo !== actor.id) {
      throw ApiError.forbidden("Sales Executives cannot assign deals to others");
    }
    assignedTo = actor._id;
  } else {
    assignedTo = input.assignedTo
      ? (await assertAssignable(actor, input.assignedTo))._id
      : customer.assignedTo;
  }

  const deal = await Deal.create({
    name: input.name,
    customerId: customer._id,
    leadId: customer.leadId ?? null, // keeps the original-lead relationship
    assignedTo,
    value: input.value,
    probability: input.probability,
    expectedCloseDate: input.expectedCloseDate,
    description: input.description,
    stage: DEAL_STAGES.QUALIFICATION, // new deals always start here
    createdBy: actor._id,
  });

  await logTimeline({
    action: TIMELINE_ACTIONS.DEAL_CREATED,
    entityType: ENTITY_TYPES.DEAL,
    entityId: deal._id,
    performedBy: actor._id,
    newValue: { value: deal.value, probability: deal.probability, stage: deal.stage, customerId: customer.id },
  });
  return deal.populate(POPULATE);
};

export const listDeals = async (q: ListDealsQuery, actor: Actor) => {
  if (q.minAmount !== undefined && q.maxAmount !== undefined && q.minAmount > q.maxAmount) {
    throw ApiError.badRequest("minAmount cannot be greater than maxAmount");
  }

  const statusFilter: Filter =
    q.status === "open" ? { stage: { $in: ACTIVE_DEAL_STAGES } }
    : q.status === "won" ? { stage: DEAL_STAGES.WON }
    : q.status === "lost" ? { stage: DEAL_STAGES.LOST }
    : {};

  const filter = andFilters(
    await buildAccessScope(actor), // role scope ALWAYS applied
    searchFilter(q.search, ["name", "description"]),
    dateRangeFilter("createdAt", q.dateFrom, q.dateTo),
    dateRangeFilter("expectedCloseDate", q.closeDateFrom, q.closeDateTo),
    numberRangeFilter("value", q.minAmount, q.maxAmount),
    statusFilter,
    q.stage ? { stage: q.stage } : {},
    q.assignedTo ? { assignedTo: q.assignedTo } : {},
    q.customerId ? { customerId: q.customerId } : {}
  );

  return paginate(Deal, filter, {
    page: q.page,
    limit: q.limit,
    sort: buildSort(q.sortBy, q.order, SORTABLE),
    populate: POPULATE,
  });
};

export const getDealById = async (id: string, actor: Actor) => {
  const deal = await findScopedDeal(id, actor);
  return deal.populate(POPULATE);
};

export const updateDeal = async (id: string, input: UpdateDealInput, actor: Actor) => {
  const deal = await findScopedDeal(id, actor);
  assertOpen(deal.stage);

  deal.set(input);
  await deal.save(); // pre-validate hook recomputes expectedRevenue
  return deal.populate(POPULATE);
};

export const updateDealStage = async (id: string, input: DealStageInput, actor: Actor) => {
  const deal = await findScopedDeal(id, actor);
  const from = deal.stage;
  const to = input.stage;
  let reopened = false;

  if (from === to) throw ApiError.badRequest(`Deal is already in ${to}`);

  if (isClosed(from)) {
    // closed deals are locked; only an Admin may reopen, and only to an active stage
    if (actor.role !== ROLES.ADMIN) {
      throw ApiError.conflict("Closed deals cannot be moved. Ask an Admin to reopen it");
    }
    if (isClosed(to)) throw ApiError.conflict("Reopen the deal before closing it again");
    if (input.probability === undefined) {
      throw ApiError.badRequest("probability is required when reopening a deal");
    }
    deal.stage = to;
    deal.probability = input.probability;
    deal.lostReason = undefined;
    deal.closedAt = null;
    reopened = true;
  } else if (to === DEAL_STAGES.LOST) {
    if (!input.lostReason?.trim()) throw ApiError.badRequest("A lost reason is required when a deal is Lost");
    deal.stage = to;
    deal.lostReason = input.lostReason; // hook forces probability to 0
    deal.closedAt = new Date();
  } else if (to === DEAL_STAGES.WON) {
    const customer = await Customer.findById(deal.customerId);
    if (!customer || customer.status !== CUSTOMER_STATUS.ACTIVE) {
      throw ApiError.badRequest("Cannot win a deal for an inactive customer");
    }
    deal.stage = to; // hook forces probability to 100
    deal.closedAt = new Date();
  } else {
    deal.stage = to;
    if (input.probability !== undefined) deal.probability = input.probability;
  }

  await deal.save();

  await logTimeline({
    action:
      to === DEAL_STAGES.WON ? TIMELINE_ACTIONS.DEAL_WON
      : to === DEAL_STAGES.LOST ? TIMELINE_ACTIONS.DEAL_LOST
      : TIMELINE_ACTIONS.DEAL_STAGE_CHANGED,
    entityType: ENTITY_TYPES.DEAL,
    entityId: deal._id,
    performedBy: actor._id,
    previousValue: from,
    newValue: {
      stage: to,
      probability: deal.probability,
      expectedRevenue: deal.expectedRevenue,
      ...(to === DEAL_STAGES.LOST && { lostReason: deal.lostReason }),
      ...(reopened && { reopened: true }),
    },
  });
  return deal.populate(POPULATE);
};

export const assignDeal = async (id: string, assigneeId: string, actor: Actor) => {
  const deal = await findScopedDeal(id, actor);
  assertOpen(deal.stage);

  const assignee = await assertAssignable(actor, assigneeId);
  if (deal.assignedTo.toString() === assignee.id) {
    throw ApiError.badRequest("Deal is already assigned to this user");
  }

  const previous = await User.findById(deal.assignedTo).select("name");
  const previousId = deal.assignedTo;
  deal.assignedTo = assignee._id;
  await deal.save();

  await logTimeline({
    action: TIMELINE_ACTIONS.DEAL_ASSIGNED,
    entityType: ENTITY_TYPES.DEAL,
    entityId: deal._id,
    performedBy: actor._id,
    previousValue: { id: previousId.toString(), name: previous?.name },
    newValue: { id: assignee.id, name: assignee.name },
  });
  return deal.populate(POPULATE);
};

export const deleteDeal = async (id: string, actor: Actor) => {
  const deal = await findScopedDeal(id, actor); // route is Admin-only
  if (deal.stage === DEAL_STAGES.WON) {
    throw ApiError.conflict("Won deals are revenue records and cannot be deleted");
  }
  if (await Lead.exists({ convertedDealId: deal._id })) {
    throw ApiError.conflict("Deals created by lead conversion cannot be deleted. Mark the deal as Lost instead");
  }
  await Promise.all([
    Activity.deleteMany({ entityType: ENTITY_TYPES.DEAL, entityId: deal._id }),
    Timeline.deleteMany({ entityType: ENTITY_TYPES.DEAL, entityId: deal._id }),
  ]);
  await deal.deleteOne();
};

export const getDealTimeline = async (id: string, q: TimelineQuery, actor: Actor) => {
  await findScopedDeal(id, actor);
  return listTimeline(ENTITY_TYPES.DEAL, id, q);
};